import { beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import {
  addCategory,
  createBackup,
  openWordsDB,
  readAll,
  recordReview,
  removeWord,
  restoreBackup,
  saveWord,
} from "../src/db";
import { makeWord } from "../src/model";
import { parseBackup, toCSV } from "../src/backup";

beforeEach(async () => {
  await deleteDB("my-words");
});

describe("真实 IndexedDB API 持久化与事务（fake-indexeddb）", () => {
  it("新增、重开数据库读取、编辑、收藏、掌握、删除及关联复习记录", async () => {
    const word = makeWord("  Apple ", {
      chinese: "苹果",
      notes: "早餐",
      category: "日常英语",
    });
    await saveWord(word);
    const db = await openWordsDB();
    db.close();
    let state = await readAll();
    expect(state.words).toHaveLength(1);
    expect(state.words[0]).toMatchObject({
      text: "apple",
      chinese: "苹果",
      notes: "早餐",
    });
    await saveWord({
      ...state.words[0],
      chinese: "苹果；苹果树",
      favorite: true,
    });
    await recordReview(state.words[0], true);
    state = await readAll();
    expect(state.words[0]).toMatchObject({
      chinese: "苹果；苹果树",
      favorite: true,
      mastered: true,
    });
    expect(state.reviews).toHaveLength(1);
    await removeWord(word.id);
    state = await readAll();
    expect(state.words).toHaveLength(0);
    expect(state.reviews).toHaveLength(0);
  });
  it("大小写和多余空格不产生重复单词，改名也受唯一索引保护", async () => {
    const first = makeWord("Apple");
    await saveWord(first);
    await expect(saveWord(makeWord("  APPLE "))).rejects.toThrow("已经");
    const second = makeWord("banana");
    await saveWord(second);
    await expect(saveWord({ ...second, text: "Apple" })).rejects.toThrow(
      "已经",
    );
    expect((await readAll()).words).toHaveLength(2);
  });
  it("JSON 完整恢复分类、英文数据和学习记录；重复导入保持幂等且保留本地修改", async () => {
    const word = makeWord("ceramic", {
      chinese: "陶瓷",
      notes: "釉料",
      category: "釉料词汇",
      phonetic: "/səˈræmɪk/",
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "A ceramic material.",
          example: "This is ceramic.",
        },
      ],
    });
    await saveWord(word);
    await addCategory("旅行");
    await recordReview(word, false);
    const backup = parseBackup(JSON.stringify(await createBackup()));
    await deleteDB("my-words");
    expect(await restoreBackup(backup)).toEqual({ added: 1, skipped: 0 });
    let state = await readAll();
    expect(state.categories).toContain("旅行");
    expect(state.categories).toContain("釉料词汇");
    expect(state.words[0].meanings[0].example).toBe("This is ceramic.");
    expect(state.reviews[0].wordId).toBe(state.words[0].id);
    await saveWord({ ...state.words[0], notes: "本机修改" });
    expect(await restoreBackup(backup)).toEqual({ added: 0, skipped: 1 });
    state = await readAll();
    expect(state.words[0].notes).toBe("本机修改");
    expect(state.reviews).toHaveLength(1);
  });
});

describe("备份校验与 CSV 安全", () => {
  it("新旧 v1 备份兼容：中文来源与本地英文来源可以完整备份恢复", async () => {
    await saveWord(
      makeWord("ceramic", {
        chinese: "陶瓷",
        chineseSource: "ecdict",
        dictionarySource: "ecdict",
        notes: "我自己的中文备注",
      }),
    );
    const backup = await createBackup();
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored.words[0]).toMatchObject({
      chineseSource: "ecdict",
      dictionarySource: "ecdict",
      notes: "我自己的中文备注",
    });
    delete backup.words[0].chineseSource;
    delete backup.words[0].dictionarySource;
    expect(parseBackup(JSON.stringify(backup)).words[0].chinese).toBe("陶瓷");
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          words: [{ ...backup.words[0], chineseSource: "untrusted" }],
        }),
      ),
    ).toThrow();
  });
  it("拒绝损坏、错误版本、重复单词、孤立复习记录，不修改数据库", async () => {
    await saveWord(makeWord("safe", { chinese: "安全" }));
    const backup = await createBackup();
    expect(() => parseBackup("not-json")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...backup, version: 999 })),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          words: [...backup.words, backup.words[0]],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          reviews: [
            {
              id: "r1",
              wordId: "missing",
              result: "mastered",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          words: [{ ...backup.words[0], favorite: "yes" }],
        }),
      ),
    ).toThrow();
    expect((await readAll()).words[0].chinese).toBe("安全");
  });
  it("导入会去除非 HTTPS 音频和来源链接", async () => {
    await saveWord(makeWord("test"));
    const backup = await createBackup();
    backup.words[0].sourceUrl = "javascript:alert(1)";
    backup.words[0].pronunciations = [
      { text: "", audio: "http://insecure.test/audio", accent: "其他" },
    ];
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored.words[0].sourceUrl).toBe("");
    expect(restored.words[0].pronunciations[0].audio).toBe("");
  });
  it("CSV 使用 BOM、CRLF 和正确转义，并防止单元格公式执行", () => {
    const csv = toCSV([
      makeWord("apple", {
        chinese: '苹果,"水果"',
        notes: '=HYPERLINK("bad")\n下一行',
      }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"苹果,""水果"""');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")\n下一行"');
    expect(csv).toContain("\r\n");
  });
});
