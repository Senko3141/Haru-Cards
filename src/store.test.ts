import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { Rating } from "ts-fsrs";
import {
  initialData,
  queue,
  review,
  newToday,
  parseBackup,
  saveData,
  readData,
  mergeStarterContent,
} from "./store";
const now = new Date("2026-10-01T12:00:00");
describe("learning and review", () => {
  it("locks cards until their lesson is complete", () => {
    const d = initialData();
    expect(queue(d, now)).toHaveLength(0);
    d.completed = ["vowels"];
    expect(queue(d, now)).toHaveLength(5);
  });
  it("counts new introductions once and keeps due learning cards available at the daily limit", () => {
    let d = initialData();
    d.completed = ["vowels"];
    d.settings.newLimit = 1;
    const id = queue(d, now)[0].id;
    d = review(d, id, Rating.Again, now);
    expect(newToday(d, now)).toBe(1);
    expect(queue(d, now)).toHaveLength(0);
    const later = new Date(+now + 10 * 60 * 1000);
    expect(queue(d, later)[0].id).toBe(id);
    d = review(d, id, Rating.Good, later);
    expect(newToday(d, later)).toBe(1);
  });
  it("resets new-card availability on the next local day", () => {
    let d = initialData();
    d.completed = ["vowels"];
    d.settings.newLimit = 1;
    d = review(d, queue(d, now)[0].id, Rating.Easy, now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(newToday(d, tomorrow)).toBe(0);
    expect(queue(d, tomorrow).some((c) => c.schedule.reps === 0)).toBe(true);
  });
  it("zero new-card limit never suppresses due reviews", () => {
    let d = initialData();
    d.completed = ["vowels"];
    const id = queue(d, now)[0].id;
    d = review(d, id, Rating.Again, now);
    d.settings.newLimit = 0;
    expect(queue(d, new Date(+now + 600000))).toHaveLength(1);
  });
  it("schedules all four ratings with FSRS and preserves a history record", () => {
    for (const rating of [1, 2, 3, 4] as const) {
      const d = initialData();
      const next = review(d, d.cards[0].id, rating, now);
      expect(next.cards[0].schedule.reps).toBe(1);
      expect(+next.cards[0].schedule.due).toBeGreaterThan(+now);
      expect(next.history[0].rating).toBe(rating);
    }
  });
});
describe("backup and storage", () => {
  it("round-trips dates, lessons, settings, and review history", () => {
    let d = initialData();
    d = review(d, d.cards[0].id, Rating.Good, now);
    const restored = parseBackup(JSON.parse(JSON.stringify(d)));
    expect(restored).toEqual(d);
    expect(restored.cards[0].schedule.due).toBeInstanceOf(Date);
  });
  it("rejects malformed, unsupported, duplicate, and inconsistent backups", () => {
    const d = initialData();
    for (const bad of [
      {},
      { ...d, version: 2 },
      { ...d, settings: { newLimit: -1 } },
      { ...d, cards: [d.cards[0], d.cards[0]] },
      { ...d, completed: ["missing"] },
      {
        ...d,
        cards: [
          { ...d.cards[0], schedule: { ...d.cards[0].schedule, due: "bad" } },
        ],
      },
    ]) {
      expect(() => parseBackup(bad)).toThrow();
    }
  });
  it("detects stale writers without rejecting normalized dates", async () => {
    const d = initialData();
    await saveData(d);
    const loaded = await readData();
    const changed = { ...loaded, settings: { newLimit: 10 } };
    await saveData(changed, loaded);
    await expect(
      saveData({ ...loaded, settings: { newLimit: 20 } }, loaded),
    ).rejects.toThrow("Data changed");
    expect((await readData()).settings.newLimit).toBe(10);
  });
  it("persists all data in IndexedDB across loads", async () => {
    const d = initialData();
    d.completed = ["vowels"];
    d.settings.newLimit = 10;
    await saveData(d);
    expect(await readData()).toEqual(d);
  });
});

describe("starter content upgrades", () => {
  function oldDeck() {
    let data = initialData();
    data.cards = data.cards.filter(
      (card) => card.lessonId !== "words" || Number(card.id.split("-")[1]) < 8,
    );
    data = review(data, "words-0", Rating.Good, now);
    data.cards.find((card) => card.id === "words-0")!.back =
      "My edited meaning";
    data.cards.push({
      ...data.cards[0],
      id: "my-custom-card",
      lessonId: "custom",
      front: "Custom word",
    });
    data.completed = ["words"];
    data.settings.newLimit = 3;
    return data;
  }
  it("adds new cards while preserving all saved cards, reviews, and preferences", () => {
    const old = oldDeck();
    const original = structuredClone(old);
    const next = mergeStarterContent(old);
    expect(old).toEqual(original);
    expect(next.cards.slice(0, old.cards.length)).toEqual(old.cards);
    expect(next.cards).toHaveLength(initialData().cards.length + 1);
    expect(next.history).toEqual(old.history);
    expect(next.completed).toEqual(old.completed);
    expect(next.settings).toEqual(old.settings);
    expect(
      next.cards.find((card) => card.id === "words-8")!.schedule.reps,
    ).toBe(0);
    expect(mergeStarterContent(next)).toEqual(next);
  });
  it("persists the migration and allows the next save without a false conflict", async () => {
    const old = oldDeck();
    await saveData(old);
    const loaded = await readData();
    expect(loaded.cards).toHaveLength(initialData().cards.length + 1);
    expect(await readData()).toEqual(loaded);
    await saveData({ ...loaded, settings: { newLimit: 10 } }, loaded);
    expect((await readData()).settings.newLimit).toBe(10);
    await expect(saveData(old, old)).rejects.toThrow("Data changed");
  });
  it("upgrades old backups, refreshes lessons, and preserves imported lessons", () => {
    const old = oldDeck();
    old.lessons[0].text = "Old explanation";
    old.lessons.push({ ...old.lessons[0], id: "extra-lesson" });
    const restored = mergeStarterContent(
      parseBackup(JSON.parse(JSON.stringify(old))),
    );
    expect(restored.lessons[0].text).toBe(initialData().lessons[0].text);
    expect(
      restored.lessons.some((lesson) => lesson.id === "extra-lesson"),
    ).toBe(true);
    expect(restored.cards.find((card) => card.id === "words-0")).toEqual(
      old.cards.find((card) => card.id === "words-0"),
    );
    expect(
      queue(restored, now).filter((card) => card.schedule.reps === 0),
    ).toHaveLength(2);
  });
});
