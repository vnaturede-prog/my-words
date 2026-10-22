import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupWord } from "../src/dictionary";

afterEach(() => vi.unstubAllGlobals());
describe("免费词典", () => {
  it("提取真实响应字段，识别英美音频，不生成中文翻译或例句", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            word: "hello",
            phonetic: "/həˈləʊ/",
            phonetics: [
              {
                text: "/həˈloʊ/",
                audio: "https://audio.example/hello-us.mp3",
              },
              { audio: "https://audio.example/hello-uk.mp3" },
            ],
            meanings: [
              {
                partOfSpeech: "interjection",
                definitions: [{ definition: "A greeting." }],
              },
            ],
            sourceUrls: ["https://en.wiktionary.org/wiki/hello"],
            license: {
              name: "CC BY-SA 3.0",
              url: "https://creativecommons.org/licenses/by-sa/3.0",
            },
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const data = await lookupWord("hello");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
      { signal: undefined },
    );
    expect(data.pronunciations.map((p) => p.accent)).toEqual(["US", "UK"]);
    expect(data.meanings[0]).toEqual({
      partOfSpeech: "interjection",
      definition: "A greeting.",
      example: "",
    });
    expect(data.license).toBe("CC BY-SA 3.0");
  });
  it("404、服务错误、网络异常和损坏的词典响应允许界面提示手动录入", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    );
    await expect(lookupWord("unknown")).rejects.toThrow("手动");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("upstream error", { status: 530 })),
    );
    await expect(lookupWord("apple")).rejects.toThrow("手动");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(lookupWord("offline")).rejects.toThrow("network");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[null]")));
    await expect(lookupWord("broken")).rejects.toThrow("可用内容");
  });
});
