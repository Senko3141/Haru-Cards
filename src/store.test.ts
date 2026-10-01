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
  it("makes every card available before completing any lessons", () => {
    const data = initialData();
    expect(queue(data, now)).toHaveLength(data.cards.length);
    expect(queue(data, now).some((c) => c.lessonId === "words")).toBe(true);
  });
  it("keeps all cards available after reaching a daily goal, including zero", () => {
    let data = initialData();
    data.settings.newLimit = 0;
    data = review(data, data.cards[0].id, Rating.Good, now);
    expect(newToday(data, now)).toBe(1);
    expect(queue(data, now)).toHaveLength(data.cards.length);
    expect(queue(data, now).at(-1)!.id).toBe(data.cards[0].id);
    const later = new Date(+data.cards[0].schedule.due + 1);
    expect(queue(data, later)[0].id).toBe(data.cards[0].id);
    data = review(data, data.cards[0].id, Rating.Good, later);
    expect(data.history.filter((h) => h.isNew)).toHaveLength(1);
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
    ).toHaveLength(
      restored.cards.filter((card) => card.schedule.reps === 0).length,
    );
  });
});
