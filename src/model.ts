export const DEFAULT_CATEGORIES = [
  "日常英语",
  "商务英语",
  "陶瓷专业英语",
  "其他",
];

export interface Meaning {
  partOfSpeech: string;
  definition: string;
  example: string;
}
export interface Pronunciation {
  text: string;
  audio: string;
  accent: "US" | "UK" | "其他";
}
export interface DictionaryData {
  dictionarySource?: "free-dictionary" | "ecdict";
  phonetic: string;
  pronunciations: Pronunciation[];
  meanings: Meaning[];
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}
export interface Word extends DictionaryData {
  id: string;
  text: string;
  normalized: string;
  chinese: string;
  chineseSource?: "ecdict" | "manual";
  notes: string;
  category: string;
  favorite: boolean;
  mastered: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Review {
  id: string;
  wordId: string;
  result: "mastered" | "learning";
  createdAt: string;
}
export interface Backup {
  format: "my-words";
  version: 1;
  exportedAt: string;
  words: Word[];
  categories: string[];
  reviews: Review[];
}
export const emptyDictionary = (): DictionaryData => ({
  phonetic: "",
  pronunciations: [],
  meanings: [],
  sourceUrl: "",
  license: "",
  licenseUrl: "",
});

export function normalizeWord(text: string) {
  return text.trim().replace(/\s+/g, " ").replace(/’/g, "'").toLowerCase();
}
export function validWord(text: string) {
  return (
    /^[a-z]+(?:[ '-][a-z]+)*$/.test(normalizeWord(text)) &&
    normalizeWord(text).length <= 100
  );
}
export function safeHttps(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function makeWord(text: string, fields: Partial<Word> = {}): Word {
  const normalized = normalizeWord(text);
  const now = new Date().toISOString();
  return {
    ...emptyDictionary(),
    id: crypto.randomUUID(),
    text: normalized,
    normalized,
    chinese: "",
    notes: "",
    category: DEFAULT_CATEGORIES[0],
    favorite: false,
    mastered: false,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}
