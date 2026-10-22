# My Words 我的随身单词本

一个适合 iPhone Safari 的中文英语单词本。无需登录、云数据库、付费 API 或苹果开发者账号，通过 GitHub Pages 免费托管，部署后即可添加到主屏幕。

## 已实现的功能

- 首页快速输入英文单词或短语，自动查询 Free Dictionary API：音标、词性、英文释义、词典提供的例句与音频。
- 分开显示美式、英式音标与词典发音按钮。词典没有提供某种音标时明确说明，不把同一个通用音标冒充两种口音；系统有对应英文语音时，还可选择“美式/英式设备朗读”。
- 自动填入收录词的中文释义，支持手动修改；每个词都有独立的个人中文备注。手写和已保存的解释不会被后续查词覆盖。
- 编辑、删除、英文/中文/备注搜索、收藏、已掌握/未掌握状态与筛选。
- 预设“日常英语”“商务英语”“陶瓷专业英语”“其他”，可创建自定义分类。
- 显示单词总数、已掌握数、收藏数与今日复习次数；随机卡片复习支持全部、未掌握、收藏以及分类范围，复习结果持久保存。
- IndexedDB 本机存储；首次联网缓存完成后，可离线打开、添加、编辑、删除、搜索与复习。
- JSON 完整备份和导入恢复（包含分类与复习记录）；CSV 表格导出采用 UTF-8 BOM，中文可正常显示。
- 自定义 App 图标、iPhone 安全区适配、底部导航、PWA 更新提示与离线就绪提示。

## 在 iPhone 上使用

1. GitHub Pages 部署成功后，用 **Safari** 打开 **https://vnaturede-prog.github.io/my-words/**。首次部署完成前，该地址可能显示 404。
2. 联网等待页面右上角显示“离线已就绪”。
3. 点 Safari 的**分享**按钮 → **添加到主屏幕** → **添加**。
4. 点击 My Words 图标即可使用，不需要从 App Store 下载。
5. 首页输入单词，点击箭头，等待自动查词；中文释义自动填入后可以修改，英文词性、解释和可用例句会直接显示。选择分类、写个人备注后，点击“保存单词”。
6. 词典失败或离线时，仍然可以手动保存。查询时可点击“跳过查询”，之后在“编辑单词”中重新查词。

英文输入支持字母、空格、连字符、撇号，例如 `apple`、`business trip`、`well-known`。词典是否收录短语取决于数据源。点击单词卡片进入详情，可以编辑、删除、收藏或更改掌握状态。

## 自动中文释义、英美发音和例句

- **中文释义**：随 App 提供 [ECDICT](https://github.com/skywind3000/ECDICT) 开源英汉词典的 91,144 个词条，涵盖常用词、学习词汇、源词典明确关联的复数/动词变化形式（如 `reels`、`walked`）及部分陶瓷术语（如 `ceramic`、`glaze`）。输入收录词后自动填入真实词典中文，不需要账号、付费翻译 API 或外部翻译请求。变化形式使用源词典中该词形自己的中文、英文释义和音标，不通过简单去后缀猜测词义。它是词典释义查询，不是无限制的整句机器翻译；未收录的词/短语会提示手动填写。
- **修改与保护**：可直接修改自动中文。查询尚未完成时已经输入的中文和备注也不会被晚返回的结果覆盖。已有解释默认保留；只有主动点击“用词典中文替换当前解释”才会替换。对已有单词，可打开“编辑单词”点击“查词”补全。
- **英文内容**：在线优先使用 Free Dictionary API 的真实英文词性、释义和例句。查询失败或离线时，收录词可显示 ECDICT 的英文词性、释义和通用音标；没有例句时明确说明，不编造例句。
- **音标与发音**：英美音标以在线词典返回的数据为准。只有带明确口音标识的录音才标记美式或英式。ECDICT 的单一通用音标不会复制成英美两套。设备朗读使用浏览器实际提供的 `en-US`/`en-GB` 语音，与词典录音分开标注；系统没有对应语音时不假装可播放。
- **首次缓存**：本地词典按字母分组，总静态数据约 16 MB（服务器可能压缩传输）。首次安装或本次更新请保持联网，等缓存完成后，离线也能自动查收录词的中文释义。音频及设备朗读是否能离线使用，取决于词典和系统语音。

更新不改变 IndexedDB 数据库版本，也不会清空已有单词。新的中文来源字段是可选信息，原有 v1 JSON 备份仍可导入，新备份会保留来源信息。

## 数据安全与备份

**单词只保存在当前设备、浏览器和网站域名下，不会同步到 GitHub 或 Vercel。** 更换手机、清除 Safari 网站数据、使用无痕模式、系统回收存储或换一个部署域名，可能导致数据不可用。请使用稳定的正式域名，勿把临时预览网址作为长期单词本。

建议每周、每次大批量录入后，以及升级或换手机前备份：

1. 点击右上角设置图标或“数据备份”。
2. 点击**导出 JSON 备份**，在 Safari 下载列表/“文件”App 中确认文件确实保存；建议再放入 iCloud 云盘。页面只能知道已发起下载，不能保证用户最终保存成功。
3. 恢复时，点击**导入 JSON 恢复**，选择本 App 导出的 JSON 文件，核对数量后点击**确认导入**。
4. 导入会合并数据。同一个英文单词保留本机现有内容；缺少的单词和分类会新增，复习记录按记录 ID 去重。若希望用备份中的内容覆盖某个单词，请先备份当前数据，再删除该单词后导入。

备份文件上限为 10 MB；格式错误、重复条目、损坏的字段或不支持的版本会拒绝导入，整次合并使用 IndexedDB 事务，避免部分恢复。导入文件仅在本机读取，不上传。

CSV 用来在 Excel/Numbers 中查看和打印，**不能代替可恢复的 JSON 备份**。导出会转义引号与换行，并对公式起始字符加保护前缀。

## 离线与更新

- 生产构建由 `vite-plugin-pwa` / Workbox 生成 Service Worker，预缓存页面、JavaScript、CSS、图标、manifest 与本地英汉词典。首次联网成功安装缓存后才能离线打开。
- 在线词典和音频按需联网请求，不预缓存远程音频；离线音频播放不作保证。
- 数据库名为 `my-words`、版本为 `1`。数据分别存放于 `words`、`categories`、`reviews`、`settings`，更新缓存不会清空数据库。
- 新版本就绪后页面出现“立即更新”。更新前请保存编辑内容并导出备份；如果正在编辑或导入，更新提示会暂时隐藏。
- 开发服务器不启用离线缓存，离线与安装功能请使用正式部署或本地生产预览验证。
- 尚未在实体 iPhone 上验收；自动化移动浏览器测试不能完全代替设备上的安装、iOS 音频策略和系统存储回收测试。

## 更新与合并 Pull Request

1. 打开仓库的 **Pull requests**，进入对应功能分支面向 `main` 的 PR。
2. 查看 **Files changed** 和 **Checks**。CI 会运行单元测试、生产构建，以及 Chromium/WebKit 的 iPhone 尺寸浏览器测试。
3. 检查通过后，点击 **Merge pull request**（或 **Squash and merge**）→ **Confirm merge**。
4. 合并到 `main` 后，**Deploy GitHub Pages** 工作流会自动运行；等待部署成功后，正式网址就会更新。

## 免费部署到 GitHub Pages（推荐）

不需要 Vercel 账号或短信验证。免费个人方案通常要求仓库为 **Public**；公开后其他人能查看应用源码和提交历史，但你的浏览器单词、备注、JSON 下载文件不会因此上传。

### 首次开启

1. 进入 [仓库 Settings](https://github.com/vnaturede-prog/my-words/settings)。如果仓库是 Private，在页面最下方 **Danger Zone → Change repository visibility** 中改为 **Public**。此操作会公开仓库内容，必须由仓库所有者授权。
2. 打开 [Settings → Pages](https://github.com/vnaturede-prog/my-words/settings/pages)。
3. 在 **Build and deployment → Source** 选择 **GitHub Actions**。不需要选择 `gh-pages` 分支。
4. 打开 [Actions](https://github.com/vnaturede-prog/my-words/actions)，选择 **Deploy GitHub Pages**。首次可点 **Run workflow → main → Run workflow**，以后每次合并到 `main` 都会自动部署。
5. 等待 `build` 和 `deploy` 都变为绿色，再打开 **https://vnaturede-prog.github.io/my-words/**。

工作流会安装锁定依赖、运行单元测试、生产构建和 Chromium/WebKit 的浏览器测试，全部通过后上传 `dist` 并发布。代码验证还会分别测试根路径 `/` 和 GitHub Pages 的 `/my-words/` 路径。

如果当前 GitHub 授权提示 `Resource not accessible by integration (403)`，这是仓库设置权限不足；推送代码的权限并不等同于修改可见性或 Pages 的权限。仓库所有者仍可在上面的网页完成设置，不必把访问令牌发给别人。

### 路径与 PWA

GitHub 仓库网站位于 `/my-words/` 子路径。部署工作流设置 `VITE_BASE_PATH=/my-words/`，Vite 静态资源、图标、manifest 的 `id/start_url/scope`、Service Worker 注册与离线入口都使用相同路径。正式打开时保留网址末尾的 `/`。

切换到 GitHub Pages 是切换网站域名；如果曾在其他域名使用 App，请先导出 JSON，再在 Pages 网址导入。浏览器不会自动跨域迁移数据。

## Vercel 部署（可选）

1. 进入 [Vercel](https://vercel.com/)，使用 GitHub 登录，选择 Hobby 免费方案（个人使用）。
2. 点击 **Add New… → Project**，导入 `vnaturede-prog/my-words`。如果找不到仓库，给 Vercel 授予访问此仓库的权限。
3. 选择 **Vite**，Root Directory 保持仓库根目录（空白或 `.`），Production Branch 设为 **main**。
4. 项目已经包含 `vercel.json`：Install Command 为 `npm ci`，Build Command 为 `npm run build`，Output Directory 为 `dist`。Node.js 选择 **24.x**。
5. **Environment Variables 留空**，无需 API Key。点击 **Deploy**。
6. 部署成功后，打开分配的正式 HTTPS 域名，在 iPhone Safari 按上面的步骤添加到主屏幕。
7. 后续向 `main` 合并代码会自动触发重新部署。预览部署用于试用，不会自动带上正式域名的本机单词。

Vercel Hobby 的可用范围和免费额度以平台当前规则为准。本项目没有后端函数或付费服务。首次绑定 Vercel/GitHub 权限需要仓库所有者本人操作。

## 本地开发与测试

推荐 Node.js **24**（`.nvmrc`），最低 Node.js 22.12；项目使用 npm，依赖版本固定在 `package-lock.json`。

```bash
npm ci
npm run dev
```

开发服务器端口默认 5173；要验证正式构建：

```bash
npm run build
npm run preview
```

生产预览默认端口 4173。访问终端显示的本地地址。PWA 在 HTTPS 或 localhost 安全上下文中工作；iPhone 通过普通局域网 HTTP 地址打开不能完整验证 Service Worker。

验证 GitHub Pages 子路径时，构建和预览必须使用相同环境变量：

```bash
VITE_BASE_PATH=/my-words/ npm run build
VITE_BASE_PATH=/my-words/ npm run preview
```

此时在本地预览网址后加 `/my-words/`。默认不设置 `VITE_BASE_PATH` 时使用 `/`，保留 Vercel 等根路径部署兼容性。

```bash
npm test
npm run typecheck
npm audit
npx playwright install --with-deps chromium webkit
npm run build
npm run test:e2e
```

浏览器测试会自动启动生产预览，覆盖新增、重复拦截、编辑、删除、收藏、复习、关闭页面后持久化、搜索、JSON/CSV 导出、无效文件拒绝、导入去重、manifest/图标检查，以及断网后的新页面启动和编辑。词典测试使用明确的模拟响应和网络失败，不把模拟结果当作真实网络可用性的证据。

使用 `VITE_BASE_PATH=/my-words/ npm run test:e2e` 可针对已构建的 Pages 版本运行同一组浏览器测试，包括实际 Service Worker scope 与 manifest 路径断言。执行前请停止其他占用 4173 端口的预览服务。

如云环境已有 Chromium，可使用现有浏览器运行 Chromium 项目：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --project=iphone-chromium --workers=2
```

如果 npm 缓存目录不可写，可在 npm 命令加 `--cache /tmp/my-words-npm-cache`。云环境的网络白名单需要允许 `api.dictionaryapi.dev`；浏览器安装还需要 Playwright 官方下载域名。GitHub PR API 操作需要允许 `api.github.com` 并具备仓库写入权限。

## 项目结构

```text
src/App.tsx          中文界面、单词编辑、详情、备份与卡片复习
src/styles.css       手机/桌面响应式样式和 iPhone 安全区
src/model.ts         数据类型、单词规范化和链接校验
src/db.ts            IndexedDB、唯一索引和事务
src/dictionary.ts    Free Dictionary API 查询与音频标识解析
src/local-dictionary.ts  本地英汉释义与英文词性查询
src/backup.ts        JSON 格式校验、导出恢复辅助和 CSV 安全转义
public/              SVG 源图标、PNG 图标与 Apple Touch 图标
public/dictionary/   分组英汉词条、ECDICT MIT 许可和来源元数据
scripts/build-local-dictionary.py  校验固定源文件并重建本地词典
tests/               数据库/词典单元测试和移动浏览器测试
vite.config.ts       构建、manifest 和 Service Worker 配置
vercel.json          Vercel 构建与缓存响应头配置
.github/workflows/ci.yml     根路径与 Pages 子路径的持续验证
.github/workflows/pages.yml  main 分支 GitHub Pages 自动部署
```

## 隐私与词典来源

没有账号、追踪分析或服务器数据库。在线查询的英文单词会发送给 [Free Dictionary API](https://dictionaryapi.dev/)；本地中文释义在设备上查询。播放词典音频或点击来源链接会请求对应第三方网站；设备朗读由浏览器/系统语音服务决定是否联网。中文释义、备注和复习记录不会被发送给词典 API。

词典来源及许可信息显示在详情中。ECDICT 使用 MIT 许可，完整版权与许可声明位于 `public/dictionary/LICENSE.txt`；`metadata.json` 记录上游提交、源文件 SHA-256、词条数量和筛选规则。生成脚本只接受匹配校验和的固定 ECDICT CSV。常规 `npm ci` 和构建直接使用已提交的数据文件，不额外下载词典或要求 Python。源码复现时可从元数据指向的固定上游提交取得 CSV 与 LICENSE，再运行生成脚本。
