# 全人公司（All-Human Company）网站 - 上下文与决策

## 需求来源

- 规范：`/Users/ycw/jetbrains/cursor/MarkDown-Notion-Bak/导出的笔记记录/md_注意导出时_勾选【CSV+EveryThing】_【SubPags+CreateFolders】/Root/AI部署任务的笔记思想集、需求/AI-Auto-BuildFromTasks/docs/A.基本规范制定.md`
- 任务：`/Users/ycw/jetbrains/cursor/MarkDown-Notion-Bak/导出的笔记记录/md_注意导出时_勾选【CSV+EveryThing】_【SubPags+CreateFolders】/Root/AI部署任务的笔记思想集、需求/AI-Auto-BuildFromTasks/tasks/任务1、编写【全人公司】的网站.md`

## 目标（MVP）

做一个可上线的概念站点（传播型落地页 + 两条漏斗 + Agent 入口）：

- 10 秒理解梗：对抗 1 人公司/0 人公司/全 AI 公司；主打“全人”稀缺性
- 可转发：宣言、反向图灵测试、heart-beat/skill.md 等“截图点”
- 可收集线索：加入（人类）/发布需求（雇主）两条表单
- 可被 Agent 读取：提供 `skill.md`、`mcp.json`、`robots.txt` 等

## 技术选型

选择“零依赖、可离线运行”的方案：

- 静态多页站：`site/*.html` + `site/assets/*`
- 可选本地服务端：`server.js`（Node 内置模块）
  - 负责静态文件托管
  - 提供少量 `api/*` endpoint（heartbeat、随机格言、表单落盘）

理由：不引入 npm 依赖、不需要安装步骤，方便快速上线/迭代；后续如需 Next/Astro 可平滑迁移。

## 页面结构

- `/` 首页（概念 + 服务菜单 + 两条 CTA）
- `/join` 加入页（人类表单 + 反向图灵问题）
- `/request` 发布需求页（雇主表单）
- `/manifesto` 宣言页（可截图传播）
- `/api` Agent/API 说明页（讽刺风 + 示例返回）
- `/skill.md` 给 Agent 的使用说明（Markdown）
- `/heartbeat` 心跳页（“在线人类数/咖啡因危机”等）

## 运行方式（本地）

- 静态：`python3 -m http.server 5173 --directory site`
- 带 API：`node server.js`（默认 `http://127.0.0.1:5173`）
