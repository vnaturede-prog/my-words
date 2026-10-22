# 实际验证记录

验证日期：2026 年 10 月 22 日。此文件记录本次云环境的实际结果，不表示已在实体 iPhone 或线上 Vercel 完成验收。

| 检查 | 结果 |
| --- | --- |
| Node.js / npm | 24.19.0 / 11.9.0 |
| `npm ci`（锁定依赖安装） | 成功 |
| `npm run build`（含严格 TypeScript 检查） | 成功；生成 `dist`、manifest、Service Worker 与预缓存 |
| `npm test` | 8/8 通过，0 跳过 |
| Chromium，iPhone 13 尺寸 | 3/3 浏览器测试通过 |
| WebKit，iPhone 13 尺寸 | 3/3 浏览器测试通过 |
| `npm audit` | 0 个漏洞（包含开发依赖） |

浏览器测试真实操作了页面及 IndexedDB，覆盖新增、编辑、删除、页面关闭后重新打开的数据保留、去重、搜索、自定义分类、收藏、掌握状态、随机卡片复习和学习记录。下载得到的 JSON/CSV 文件被实际读取、检查；导入经过无效文件拒绝、删除后恢复及重复导入去重验证。

词典交互测试使用明确的模拟返回值，避免免费外部服务的波动影响功能测试。WebKit 的 Service Worker 网络请求会绕过 Playwright 的页面路由，因此模拟词典的测试关闭 Service Worker；独立 PWA 测试开启真实 Service Worker，在完成安装后切断网络，验证刷新、新页面冷启动，以及离线新增、编辑和重新读取。PWA 检查还读取了 manifest、图标的 PNG 文件头和 `sw.js`。

真实 Free Dictionary API 查询 `apple` 曾返回 HTTP 200，包含 `/ˈæp.əl/`、2 组词性释义及英美音频地址。但其他查询及带 Origin 的新请求也出现 HTTP 404/530，第三方服务存在波动；真实浏览器查询失败时，界面正确显示手动保存提示。不能据此保证词典或音频持续可用。音频按钮、音频地址和口音识别已检查，实体 iPhone 上的实际声音输出仍需验收。

云机器缺少 WebKit 的部分系统库且没有管理员密码。本次从 Debian 官方签名软件源下载对应运行库，解包到仓库外的隔离缓存目录，并使用单独启动器运行未修改的官方 Playwright WebKit；没有关闭包签名、校验和或 TLS 验证。GitHub Actions 使用标准 `playwright install --with-deps` 流程。

尚需实际设备/部署验收：iPhone Safari 的“添加到主屏幕”、主屏幕独立启动、真机音频播放，以及 Vercel 正式域名访问。中文 README 已提供合并 PR、免费部署及备份步骤。
