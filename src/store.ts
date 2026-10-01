import { openDB } from "idb";
import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import { z } from "zod";
import { lessons, starterEntries, type Entry, type Lesson } from "./content";
export type StudyCard = Entry & { schedule: Card };
export type AppData = {
  version: 1;
  lessons: Lesson[];
  cards: StudyCard[];
  completed: string[];
  settings: { newLimit: number };
  history: { cardId: string; at: string; rating: number; isNew: boolean }[];
};
export function initialData(): AppData {
  return {
    version: 1,
    lessons: structuredClone(lessons),
    cards: starterEntries.map((e) => ({ ...e, schedule: createEmptyCard() })),
    completed: [],
    settings: { newLimit: 5 },
    history: [],
  };
}
/** Add new bundled cards without replacing saved edits or scheduling state.
 * Starter IDs are persistent: append entries in content.ts, never reorder them.
 */
export function mergeStarterContent(data: AppData): AppData {
  const existingIds = new Set(data.cards.map((card) => card.id));
  const bundledLessons = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const savedLessonIds = new Set(data.lessons.map((lesson) => lesson.id));
  return {
    ...data,
    lessons: [
      ...data.lessons.map((lesson) =>
        structuredClone(bundledLessons.get(lesson.id) ?? lesson),
      ),
      ...lessons
        .filter((lesson) => !savedLessonIds.has(lesson.id))
        .map((lesson) => structuredClone(lesson)),
    ],
    cards: [
      ...data.cards,
      ...starterEntries
        .filter((entry) => !existingIds.has(entry.id))
        .map((entry) => ({
          ...entry,
          schedule: createEmptyCard(),
        })),
    ],
  };
}
const db = () =>
  openDB("haru-cards", 1, {
    upgrade(db) {
      db.createObjectStore("data");
    },
  });
export async function readData() {
  const conn = await db();
  const tx = conn.transaction("data", "readwrite");
  const saved = await tx.store.get("main");
  if (saved) {
    const parsed = parseBackup(saved);
    const merged = mergeStarterContent(parsed);
    if (JSON.stringify(merged) !== JSON.stringify(parsed)) {
      await tx.store.put(merged, "main");
    }
    await tx.done;
    return merged;
  }
  const fresh = initialData();
  await tx.store.put(fresh, "main");
  await tx.done;
  return fresh;
}
export async function saveData(data: AppData, expected?: AppData) {
  const conn = await db();
  const tx = conn.transaction("data", "readwrite");
  if (expected) {
    const saved = await tx.store.get("main");
    if (
      JSON.stringify(parseBackup(saved)) !==
      JSON.stringify(parseBackup(expected))
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw Error("Data changed in another tab");
    }
  }
  await tx.store.put(data, "main");
  await tx.done;
}
export const scheduler = fsrs({ enable_fuzz: false });
export function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function newToday(data: AppData, now: Date) {
  return data.history.filter(
    (h) => h.isNew && localDay(new Date(h.at)) === localDay(now),
  ).length;
}
export function queue(data: AppData, now: Date) {
  const unlocked = data.cards.filter(
    (c) => c.lessonId === "custom" || data.completed.includes(c.lessonId),
  );
  const due = unlocked
    .filter((c) => c.schedule.reps > 0 && c.schedule.due <= now)
    .sort((a, b) => +a.schedule.due - +b.schedule.due);
  return [
    ...due,
    ...unlocked
      .filter((c) => c.schedule.reps === 0)
      .slice(0, Math.max(0, data.settings.newLimit - newToday(data, now))),
  ];
}
export function review(
  data: AppData,
  id: string,
  rating: Grade,
  now: Date,
): AppData {
  const c = data.cards.find((c) => c.id === id);
  if (!c) throw Error("Card not found");
  const next = scheduler.next(c.schedule, now, rating).card;
  return {
    ...data,
    cards: data.cards.map((c) => (c.id === id ? { ...c, schedule: next } : c)),
    history: [
      ...data.history,
      {
        cardId: id,
        at: now.toISOString(),
        rating,
        isNew: c.schedule.reps === 0,
      },
    ],
  };
}
const text = z.string().max(2000);
const nonnegative = z.number().finite().nonnegative();
const integer = nonnegative.int();
const date = z
  .union([z.string().datetime(), z.date()])
  .transform((v) => new Date(v));
const schedule = z.object({
  due: date,
  stability: nonnegative,
  difficulty: z.number().min(0).max(10),
  elapsed_days: nonnegative,
  scheduled_days: nonnegative,
  reps: integer,
  lapses: integer,
  state: z.number().int().min(0).max(3),
  learning_steps: integer,
  last_review: date.optional(),
});
const entry = z.object({
  id: text.min(1),
  front: text.min(1),
  back: text.min(1),
  roman: text,
  note: text,
  speak: text,
  lessonId: text.min(1),
  schedule,
});
const lesson = z.object({
  id: text.min(1),
  title: text.min(1),
  subtitle: text,
  text,
  check: z.object({
    question: text,
    options: z.array(text).min(2).max(6),
    answer: integer,
    explanation: text,
  }),
});
const schema = z.object({
  version: z.literal(1),
  lessons: z.array(lesson).max(1000),
  cards: z.array(entry).max(10000),
  completed: z.array(text).max(1000),
  settings: z.object({ newLimit: z.number().int().min(0).max(100) }),
  history: z
    .array(
      z.object({
        cardId: text,
        at: z.string().datetime(),
        rating: z.number().int().min(1).max(4),
        isNew: z.boolean(),
      }),
    )
    .max(500000),
});
export function parseBackup(input: unknown): AppData {
  const data = schema.parse(input);
  const ids = new Set(data.cards.map((c) => c.id));
  const lessonIds = new Set(data.lessons.map((l) => l.id));
  if (
    ids.size !== data.cards.length ||
    lessonIds.size !== data.lessons.length ||
    data.lessons.some((l) => l.check.answer >= l.check.options.length) ||
    data.cards.some(
      (c) => c.lessonId !== "custom" && !lessonIds.has(c.lessonId),
    ) ||
    data.completed.some((id) => !lessonIds.has(id)) ||
    data.history.some((h) => !ids.has(h.cardId)) ||
    data.cards.some((c) => c.schedule.reps > 0 && !c.schedule.last_review)
  )
    throw Error("Backup contains inconsistent data");
  return data as AppData;
}
