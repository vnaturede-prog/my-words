import { openDB, type DBSchema } from "idb";
import {
  DEFAULT_CATEGORIES,
  normalizeWord,
  type Backup,
  type Review,
  type Word,
} from "./model";

interface WordsDB extends DBSchema {
  words: { key: string; value: Word; indexes: { normalized: string } };
  categories: { key: string; value: { name: string } };
  reviews: { key: string; value: Review; indexes: { wordId: string } };
  settings: { key: string; value: string };
}
export function openWordsDB() {
  return openDB<WordsDB>("my-words", 1, {
    upgrade(db) {
      const words = db.createObjectStore("words", { keyPath: "id" });
      words.createIndex("normalized", "normalized", { unique: true });
      const categories = db.createObjectStore("categories", {
        keyPath: "name",
      });
      DEFAULT_CATEGORIES.forEach((name) => categories.put({ name }));
      const reviews = db.createObjectStore("reviews", { keyPath: "id" });
      reviews.createIndex("wordId", "wordId");
      db.createObjectStore("settings");
    },
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase)?.close();
    },
  });
}
export async function readAll() {
  const db = await openWordsDB();
  try {
    const [words, categories, reviews, lastBackup] = await Promise.all([
      db.getAll("words"),
      db.getAllKeys("categories"),
      db.getAll("reviews"),
      db.get("settings", "lastBackup"),
    ]);
    return {
      words: words.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      categories: [
        ...DEFAULT_CATEGORIES,
        ...categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)),
      ],
      reviews,
      lastBackup,
    };
  } finally {
    db.close();
  }
}
export async function saveWord(word: Word) {
  const db = await openWordsDB();
  try {
    const normalized = normalizeWord(word.text);
    const tx = db.transaction(["words", "categories"], "readwrite");
    const duplicate = await tx
      .objectStore("words")
      .index("normalized")
      .get(normalized);
    if (duplicate && duplicate.id !== word.id) {
      await tx.done;
      throw new Error("这个单词已经在单词本里了。");
    }
    await tx.objectStore("categories").put({ name: word.category });
    await tx
      .objectStore("words")
      .put({ ...word, text: normalized, normalized });
    await tx.done;
  } finally {
    db.close();
  }
}
export async function removeWord(id: string) {
  const db = await openWordsDB();
  try {
    const tx = db.transaction(["words", "reviews"], "readwrite");
    await tx.objectStore("words").delete(id);
    const keys = await tx.objectStore("reviews").index("wordId").getAllKeys(id);
    await Promise.all(keys.map((key) => tx.objectStore("reviews").delete(key)));
    await tx.done;
  } finally {
    db.close();
  }
}
export async function addCategory(name: string) {
  const db = await openWordsDB();
  try {
    await db.put("categories", { name });
  } finally {
    db.close();
  }
}
export async function recordReview(word: Word, mastered: boolean) {
  const db = await openWordsDB();
  try {
    const tx = db.transaction(["words", "reviews"], "readwrite");
    const current = await tx.objectStore("words").get(word.id);
    if (!current) throw new Error("这个单词已被删除，请重新开始复习。");
    const now = new Date().toISOString();
    await tx.objectStore("words").put({ ...current, mastered, updatedAt: now });
    await tx
      .objectStore("reviews")
      .add({
        id: crypto.randomUUID(),
        wordId: word.id,
        result: mastered ? "mastered" : "learning",
        createdAt: now,
      });
    await tx.done;
  } finally {
    db.close();
  }
}
export async function createBackup(): Promise<Backup> {
  const db = await openWordsDB();
  try {
    const tx = db.transaction(["words", "categories", "reviews"], "readonly");
    const [words, categories, reviews] = await Promise.all([
      tx.objectStore("words").getAll(),
      tx.objectStore("categories").getAllKeys(),
      tx.objectStore("reviews").getAll(),
    ]);
    await tx.done;
    return {
      format: "my-words",
      version: 1,
      exportedAt: new Date().toISOString(),
      words,
      categories,
      reviews,
    };
  } finally {
    db.close();
  }
}
export async function markBackup() {
  const db = await openWordsDB();
  try {
    await db.put("settings", new Date().toISOString(), "lastBackup");
  } finally {
    db.close();
  }
}
// The file is validated before this function; the complete merge is one transaction.
export async function restoreBackup(backup: Backup) {
  const db = await openWordsDB();
  try {
    const tx = db.transaction(["words", "categories", "reviews"], "readwrite");
    const words = tx.objectStore("words");
    const idMap = new Map<string, string>();
    let added = 0;
    let skipped = 0;
    for (const word of backup.words) {
      const existing = await words.index("normalized").get(word.normalized);
      if (existing) {
        idMap.set(word.id, existing.id);
        skipped++;
        continue;
      }
      const id = crypto.randomUUID();
      idMap.set(word.id, id);
      await words.add({ ...word, id });
      added++;
    }
    for (const name of [
      ...backup.categories,
      ...backup.words.map((w) => w.category),
    ]) {
      await tx.objectStore("categories").put({ name });
    }
    for (const review of backup.reviews) {
      const wordId = idMap.get(review.wordId);
      if (wordId && !(await tx.objectStore("reviews").get(review.id))) {
        await tx.objectStore("reviews").put({ ...review, wordId });
      }
    }
    await tx.done;
    return { added, skipped };
  } finally {
    db.close();
  }
}
