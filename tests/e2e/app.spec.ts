import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const dictionary = [
  {
    word: "hello",
    phonetic: "/həˈləʊ/",
    phonetics: [
      {
        text: "/həˈloʊ/",
        audio: "https://api.dictionaryapi.dev/media/hello-us.mp3",
      },
      {
        text: "/həˈləʊ/",
        audio: "https://api.dictionaryapi.dev/media/hello-uk.mp3",
      },
    ],
    meanings: [
      {
        partOfSpeech: "interjection",
        definitions: [
          { definition: "A greeting.", example: "Hello, how are you?" },
        ],
      },
    ],
    sourceUrls: ["https://en.wiktionary.org/wiki/hello"],
    license: {
      name: "CC BY-SA 3.0",
      url: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
];

async function mockDictionary(page: Page) {
  await page.route("https://api.dictionaryapi.dev/api/**", (route) =>
    route.fulfill({ json: dictionary }),
  );
}
async function openBackup(page: Page) {
  await page.getByRole("button", { name: "备份与设置" }).click();
}
async function closeSheet(page: Page) {
  await page.getByRole("button", { name: "关闭", exact: true }).click();
}

test.describe("模拟词典的交互测试", () => {
  // WebKit service-worker network requests bypass page.route. Cache behavior is
  // exercised separately below with service workers enabled and no API mocks.
  test.use({ serviceWorkers: "block" });
  test("iPhone 单词管理、复习、持久化、JSON/CSV 导出与恢复", async ({
    page,
    context,
  }) => {
    await mockDictionary(page);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "添加第一个单词" }),
    ).toBeEnabled();
    await page.getByRole("textbox", { name: "快速添加英文单词" }).fill("hello");
    await page.getByRole("button", { name: "添加这个单词" }).click();
    await expect(
      page.getByText("已获取词典内容；中文释义请自行填写。"),
    ).toBeVisible();
    await page.getByLabel("中文释义", { exact: false }).fill("你好；喂");
    await page.getByLabel("我的中文备注").fill("出门见到朋友时说");
    await page.getByRole("button", { name: "新分类", exact: true }).click();
    await page.getByRole("textbox", { name: "新分类名称" }).fill("旅行英语");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await page.getByRole("button", { name: "保存单词", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "查看 hello" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "收藏 hello", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "取消收藏 hello" }),
    ).toBeVisible();

    // A new page in the same browser retains IndexedDB after the old page is closed.
    const reopened = await context.newPage();
    await mockDictionary(reopened);
    await page.close();
    page = reopened;
    await page.goto("/");
    await expect(page.getByText("你好；喂", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "查看 hello" }).click();
    await expect(page.getByRole("button", { name: /美式/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /英式/ })).toBeVisible();
    await expect(page.getByText("Hello, how are you?")).toBeVisible();
    await page.getByRole("button", { name: "编辑单词" }).click();
    await page.getByLabel("中文释义", { exact: false }).fill("你好（已编辑）");
    await page.getByRole("button", { name: "保存单词", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByText("你好（已编辑）"),
    ).toBeVisible();
    await closeSheet(page);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "添加单词", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("英文单词", { exact: false })
      .fill("HELLO");
    await expect(
      page.getByText("已获取词典内容；中文释义请自行填写。"),
    ).toBeVisible();
    await page.getByRole("button", { name: "保存单词", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("已经在单词本");
    await closeSheet(page);

    await page.getByRole("textbox", { name: "搜索单词" }).fill("已编辑");
    await expect(
      page.getByRole("button", { name: "查看 hello" }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "搜索单词" }).fill("no-match");
    await expect(page.getByText("没有找到匹配的单词")).toBeVisible();
    await page.getByRole("button", { name: "重置筛选" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "复习", exact: true })
      .click();
    await page.getByRole("button", { name: "随机开始复习 · 1 词" }).click();
    await page.getByRole("button", { name: "想一想，再查看释义" }).click();
    await expect(page.getByText("你好（已编辑）")).toBeVisible();
    await page.getByRole("button", { name: "已掌握", exact: true }).click();
    await expect(page.getByText("这一轮，完成了！")).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "单词本", exact: true })
      .click();
    await expect(page.locator(".mastered-label")).toContainText("已掌握");

    await openBackup(page);
    const jsonDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /导出 JSON 备份/ }).click();
    const jsonPath = await (await jsonDownload).path();
    const json = await readFile(jsonPath!, "utf8");
    const backup = JSON.parse(json);
    expect(backup.words[0].chinese).toBe("你好（已编辑）");
    expect(backup.words[0].favorite).toBe(true);
    expect(backup.words[0].mastered).toBe(true);
    expect(backup.categories).toContain("旅行英语");
    expect(backup.reviews).toHaveLength(1);
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /导出 CSV 表格/ }).click();
    const csv = await readFile((await (await csvDownload).path())!, "utf8");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("你好（已编辑）");
    await page.getByLabel("选择 JSON 备份文件").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{invalid}"),
    });
    await expect(page.getByRole("alert")).toContainText("未导入任何数据");
    await closeSheet(page);
    await page.getByRole("button", { name: "查看 hello" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByText("从第一个单词开始")).toBeVisible();
    await openBackup(page);
    await page.getByLabel("选择 JSON 备份文件").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
    await expect(
      page.getByText("导入完成：新增 1 个单词，跳过 0 个重复单词。"),
    ).toBeVisible();
    await page.getByLabel("选择 JSON 备份文件").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
    await expect(
      page.getByText("导入完成：新增 0 个单词，跳过 1 个重复单词。"),
    ).toBeVisible();
    await closeSheet(page);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "查看 hello" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/home-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
});

test("PWA manifest、图标、Service Worker 与离线冷启动后新增编辑", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("离线已就绪")).toBeVisible({ timeout: 20000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    true,
  );
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");
  }
  expect((await page.request.get("/sw.js")).status()).toBe(200);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("离线模式")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "添加单词", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("英文单词", { exact: false })
    .fill("offline");
  await page.getByLabel("中文释义", { exact: false }).fill("离线");
  await page.getByRole("button", { name: "保存单词", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看 offline" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看 offline" }).click();
  await page.getByRole("button", { name: "编辑单词" }).click();
  await page.getByLabel("我的中文备注").fill("没有网络也能修改");
  await page.getByRole("button", { name: "保存单词", exact: true }).click();
  await expect(page.getByText("没有网络也能修改")).toBeVisible();
  await closeSheet(page);
  await page.reload();
  await page.getByRole("button", { name: "查看 offline" }).click();
  await expect(page.getByText("没有网络也能修改")).toBeVisible();
  // A separate page starts from the cached app shell with no network.
  const cold = await context.newPage();
  await cold.goto("/");
  await expect(
    cold.getByRole("button", { name: "查看 offline" }),
  ).toBeVisible();
});

test.describe("网络故障交互测试", () => {
  test.use({ serviceWorkers: "block" });
  test("词典网络失败时明确提示且允许手动保存", async ({ page }) => {
    await page.route("https://api.dictionaryapi.dev/api/**", (route) =>
      route.abort("failed"),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "添加第一个单词" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("英文单词", { exact: false })
      .fill("ceramic");
    await expect(
      page.getByText("网络不可用，可以手动填写并保存。"),
    ).toBeVisible();
    await page.getByLabel("中文释义", { exact: false }).fill("陶瓷");
    await page
      .getByLabel("单词分类", { exact: true })
      .selectOption("陶瓷专业英语");
    await page.getByRole("button", { name: "保存单词", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "查看 ceramic" }),
    ).toBeVisible();
    await expect(page.getByText("陶瓷", { exact: true })).toBeVisible();
  });
});
