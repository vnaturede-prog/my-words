import {
  emptyDictionary,
  safeHttps,
  type DictionaryData,
  type Pronunciation,
} from "./model";

export async function lookupWord(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryData> {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal },
  );
  if (response.status === 404)
    throw new Error("暂未查到词典内容，可以手动填写并保存，稍后重试。");
  if (!response.ok) throw new Error("词典暂时无法连接，可以手动填写并保存。");
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.length)
    throw new Error("词典没有返回可用内容，可以手动保存。");
  const result = emptyDictionary();
  result.dictionarySource = "free-dictionary";
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    if (!result.phonetic && typeof entry.phonetic === "string")
      result.phonetic = entry.phonetic;
    for (const p of Array.isArray(entry.phonetics) ? entry.phonetics : []) {
      if (!p || typeof p !== "object") continue;
      const audio = safeHttps(p.audio);
      const text = typeof p.text === "string" ? p.text : "";
      if (!result.phonetic && text) result.phonetic = text;
      const accent: Pronunciation["accent"] = /[-_/]us(?:[.\-_/]|$)/i.test(
        audio,
      )
        ? "US"
        : /[-_/](?:uk|gb)(?:[.\-_/]|$)/i.test(audio)
          ? "UK"
          : "其他";
      if (
        (audio || text) &&
        !result.pronunciations.some((i) => i.audio === audio && i.text === text)
      )
        result.pronunciations.push({ audio, text, accent });
    }
    for (const meaning of Array.isArray(entry.meanings) ? entry.meanings : []) {
      if (!meaning || typeof meaning !== "object") continue;
      for (const d of Array.isArray(meaning.definitions)
        ? meaning.definitions
        : []) {
        if (d && typeof d.definition === "string")
          result.meanings.push({
            partOfSpeech:
              typeof meaning.partOfSpeech === "string"
                ? meaning.partOfSpeech
                : "",
            definition: d.definition,
            example: typeof d.example === "string" ? d.example : "",
          });
      }
    }
    if (!result.sourceUrl && Array.isArray(entry.sourceUrls))
      result.sourceUrl = safeHttps(entry.sourceUrls[0]);
    if (
      !result.license &&
      entry.license &&
      typeof entry.license.name === "string"
    ) {
      result.license = entry.license.name;
      result.licenseUrl = safeHttps(entry.license.url);
    }
  }
  if (
    !result.meanings.length &&
    !result.phonetic &&
    !result.pronunciations.length
  )
    throw new Error("词典没有返回可用内容，可以手动保存。");
  return result;
}
