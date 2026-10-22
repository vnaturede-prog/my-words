import {
  emptyDictionary,
  normalizeWord,
  type DictionaryData,
  type Meaning,
} from "./model";

export interface LocalEntry {
  chinese: string;
  dictionary: DictionaryData;
}
const cache = new Map<string, Record<string, unknown>>();
const parts: Record<string, string> = {
  n: "noun",
  v: "verb",
  vt: "verb",
  vi: "verb",
  a: "adjective",
  adj: "adjective",
  ad: "adverb",
  adv: "adverb",
  r: "adverb",
  s: "adjective",
  pron: "pronoun",
  prep: "preposition",
  conj: "conjunction",
  interj: "interjection",
};

export async function lookupLocalWord(
  text: string,
  signal?: AbortSignal,
): Promise<LocalEntry | null> {
  const word = normalizeWord(text);
  const letter = word[0];
  if (!letter || !/^[a-z]$/.test(letter)) return null;
  let data = cache.get(letter);
  if (!data) {
    const response = await fetch(
      `${import.meta.env.BASE_URL}dictionary/${letter}.json`,
      { signal },
    );
    if (!response.ok)
      throw new Error("本地词典尚未缓存完成，可以手动填写，联网后重试。");
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("本地词典文件不可用，请联网刷新后重试。");
    data = value as Record<string, unknown>;
    cache.set(letter, data);
  }
  const row = Object.hasOwn(data, word) ? data[word] : null;
  if (
    !Array.isArray(row) ||
    row.length !== 3 ||
    !row.every((value) => typeof value === "string")
  )
    return null;
  const [chinese, phonetic, definition] = row as [string, string, string];
  const meanings: Meaning[] = definition
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = /^(n|v|vt|vi|a|adj|ad|adv|r|s|pron|prep|conj|interj)(?:\.\s*|\s+)(.*)$/.exec(line);
      return {
        partOfSpeech: match ? parts[match[1]] || match[1] : "",
        definition: match ? match[2] : line,
        example: "",
      };
    });
  return {
    chinese,
    dictionary: {
      ...emptyDictionary(),
      phonetic,
      meanings,
      dictionarySource: "ecdict",
      sourceUrl: "https://github.com/skywind3000/ECDICT",
      license: "MIT",
      licenseUrl: "https://github.com/skywind3000/ECDICT/blob/master/LICENSE",
    },
  };
}
