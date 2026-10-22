import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("自动中文释义与本地词典", () => {
  it("规范化查询，提取中文、通用音标和真实英文词性，不伪造英美音标或例句", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            apple: [
              "n. 苹果\n苹果树",
              "'æpl",
              "n. fruit\nv. a verb definition",
            ],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const { lookupLocalWord } = await import("../src/local-dictionary");
    const entry = await lookupLocalWord("  APPLE ");
    expect(entry?.chinese).toBe("n. 苹果\n苹果树");
    expect(entry?.dictionary.dictionarySource).toBe("ecdict");
    expect(entry?.dictionary.meanings).toEqual([
      { partOfSpeech: "noun", definition: "fruit", example: "" },
      { partOfSpeech: "verb", definition: "a verb definition", example: "" },
    ]);
    expect(entry?.dictionary.pronunciations).toEqual([]);
    expect(await lookupLocalWord("absent")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/dictionary\/a\.json$/);
  });
  it("下载失败不缓存失败结果，允许联网后重试；损坏词条不会当作翻译显示", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ceramic: ["陶瓷", "", "n. ceramic material"],
            corrupt: [42],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const { lookupLocalWord } = await import("../src/local-dictionary");
    await expect(lookupLocalWord("ceramic")).rejects.toThrow("手动");
    expect((await lookupLocalWord("ceramic"))?.chinese).toBe("陶瓷");
    expect(await lookupLocalWord("corrupt")).toBeNull();
  });
  it("实际打包数据含常用词与陶瓷词汇、许可和来源信息，且可被离线预缓存", () => {
    const metadata = JSON.parse(
      readFileSync("public/dictionary/metadata.json", "utf8"),
    );
    expect(metadata.entries).toBe(91144);
    expect(metadata.license).toBe("MIT");
    for (const [word, expected] of [
      ["apple", "苹果"],
      ["ceramic", "陶瓷"],
      ["glaze", "釉"],
      ["hello", "喂"],
    ]) {
      const data = JSON.parse(
        readFileSync(`public/dictionary/${word[0]}.json`, "utf8"),
      );
      expect(data[word][0]).toContain(expected);
      expect(data[word][0]).not.toContain("\\n");
    }
    const letters = readdirSync("public/dictionary").filter((name) =>
      /^[a-z]\.json$/.test(name),
    );
    expect(letters).toHaveLength(26);
    for (const file of letters)
      expect(readFileSync(`public/dictionary/${file}`).byteLength).toBeLessThan(
        2 * 1024 * 1024,
      );
    expect(readFileSync("public/dictionary/LICENSE.txt", "utf8")).toContain(
      "Permission is hereby granted",
    );
  });
  it("复数和动词变化形式使用实际词条及其音标，保留独立词义", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const letter = /\/([a-z])\.json$/.exec(url)?.[1];
      return new Response(readFileSync(`public/dictionary/${letter}.json`, "utf8"));
    }));
    const { lookupLocalWord } = await import("../src/local-dictionary");
    const reels = await lookupLocalWord("  REELS ");
    expect(reels?.chinese).toContain("卷轴");
    expect(reels?.chinese).toContain("第三人称单数");
    expect(reels?.dictionary.phonetic).toBe("ri:lz");
    expect(reels?.dictionary.meanings[0]).toEqual({
      partOfSpeech: "noun",
      definition: "a roll of photographic film holding a series of frames to be projected by a movie projector",
      example: "",
    });
    expect(reels?.dictionary.meanings.some(m => m.partOfSpeech === "verb")).toBe(true);
    expect(reels?.dictionary.pronunciations).toEqual([]);
    for (const word of ["walks", "walked", "went", "better"])
      expect((await lookupLocalWord(word))?.chinese).toBeTruthy();
    expect((await lookupLocalWord("news"))?.chinese).toContain("新闻");
    expect((await lookupLocalWord("running"))?.chinese).toContain("跑");
    expect(await lookupLocalWord("reelzzzz")).toBeNull();
  });
});
