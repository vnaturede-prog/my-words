import {
  normalizeWord,
  safeHttps,
  validWord,
  type Backup,
  type Meaning,
  type Pronunciation,
  type Word,
  type Review,
} from "./model";

function fail(): never {
  throw new Error(
    "备份格式不正确或版本不受支持，未导入任何数据。请使用 My Words 导出的 JSON 文件。",
  );
}
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 10000): string {
  if (typeof value !== "string" || value.length > max) return fail();
  return value;
}
function nonempty(value: unknown, max = 100) {
  const s = str(value, max).trim();
  return s || fail();
}
function date(value: unknown): string {
  const s = str(value, 50);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s)))
    return fail();
  return new Date(s).toISOString();
}
function list(value: unknown, max = 100000): unknown[] {
  return Array.isArray(value) && value.length <= max ? value : fail();
}
function bool(value: unknown) {
  return typeof value === "boolean" ? value : fail();
}
function optionalSource<T extends string>(
  value: unknown,
  allowed: T[],
): T | undefined {
  if (value === undefined) return undefined;
  return allowed.includes(value as T) ? (value as T) : fail();
}
export function parseBackup(text: string): Backup {
  if (new Blob([text]).size > 10 * 1024 * 1024)
    throw new Error("文件超过 10 MB，请拆分备份后导入。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail();
  }
  const root = obj(parsed);
  if (root.format !== "my-words" || root.version !== 1) return fail();
  const ids = new Set<string>();
  const normalizedWords = new Set<string>();
  const words: Word[] = list(root.words).map((value) => {
    const w = obj(value);
    const id = nonempty(w.id);
    const text = nonempty(w.text);
    const normalized = normalizeWord(text);
    if (!validWord(text) || ids.has(id) || normalizedWords.has(normalized))
      return fail();
    ids.add(id);
    normalizedWords.add(normalized);
    const pronunciations: Pronunciation[] = list(w.pronunciations, 100).map(
      (value) => {
        const p = obj(value);
        if (!["US", "UK", "其他"].includes(String(p.accent))) return fail();
        return {
          text: str(p.text, 500),
          audio: safeHttps(str(p.audio, 2000)),
          accent: p.accent as Pronunciation["accent"],
        };
      },
    );
    const meanings: Meaning[] = list(w.meanings, 1000).map((value) => {
      const m = obj(value);
      return {
        partOfSpeech: str(m.partOfSpeech, 100),
        definition: str(m.definition),
        example: str(m.example),
      };
    });
    return {
      id,
      text: normalized,
      normalized,
      chinese: str(w.chinese),
      chineseSource: optionalSource(w.chineseSource, ["ecdict", "manual"]),
      dictionarySource: optionalSource(w.dictionarySource, [
        "ecdict",
        "free-dictionary",
      ]),
      notes: str(w.notes),
      category: nonempty(w.category, 40),
      favorite: bool(w.favorite),
      mastered: bool(w.mastered),
      createdAt: date(w.createdAt),
      updatedAt: date(w.updatedAt),
      phonetic: str(w.phonetic, 500),
      pronunciations,
      meanings,
      sourceUrl: safeHttps(str(w.sourceUrl, 2000)),
      license: str(w.license, 200),
      licenseUrl: safeHttps(str(w.licenseUrl, 2000)),
    };
  });
  const reviewIds = new Set<string>();
  const reviews: Review[] = list(root.reviews).map((value) => {
    const r = obj(value);
    const id = nonempty(r.id);
    const wordId = nonempty(r.wordId);
    if (
      !ids.has(wordId) ||
      reviewIds.has(id) ||
      !["mastered", "learning"].includes(String(r.result))
    )
      return fail();
    reviewIds.add(id);
    return {
      id,
      wordId,
      result: r.result as Review["result"],
      createdAt: date(r.createdAt),
    };
  });
  return {
    format: "my-words",
    version: 1,
    exportedAt: date(root.exportedAt),
    words,
    categories: [
      ...new Set(list(root.categories, 10000).map((c) => nonempty(c, 40))),
    ],
    reviews,
  };
}
export function toCSV(words: Word[]) {
  const cell = (value: string) => {
    // Prevent spreadsheet formula execution, including values after whitespace.
    const safe = /^[\s]*[=+@\-]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [
    [
      "英文单词",
      "音标",
      "中文释义",
      "中文备注",
      "分类",
      "收藏",
      "掌握状态",
      "添加日期",
      "英文解释",
      "例句",
    ],
    ...words.map((w) => [
      w.text,
      w.phonetic,
      w.chinese,
      w.notes,
      w.category,
      w.favorite ? "是" : "否",
      w.mastered ? "已掌握" : "未掌握",
      w.createdAt,
      w.meanings.map((m) => `${m.partOfSpeech}: ${m.definition}`).join("\n"),
      w.meanings
        .map((m) => m.example)
        .filter(Boolean)
        .join("\n"),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
