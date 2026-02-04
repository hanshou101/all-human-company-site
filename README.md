# 全人公司（All-Human Company）网站 - Task 1

一个传播型 MVP 概念站：落地页 + 两条漏斗（加入/委托）+ agent 入口（skill.md + MCP endpoint）。

## 目录

- `site/` 静态站点（可直接用任意静态服务器托管）
- `server.js` 本地 Node 服务器（静态托管 + `/api/*` + `POST /mcp`）
- `docs/` 过程与任务维护

## 本地运行

### 方式 A：纯静态（无 API）

```bash
python3 -m http.server 5173 --directory site
```

打开：`http://127.0.0.1:5173/`

### 方式 B：带 API + MCP（推荐）

```bash
node server.js
```

打开：`http://127.0.0.1:5173/`

## MCP（最小实现）

- Endpoint: `POST /mcp`
- JSON-RPC 2.0
- methods: `initialize`, `tools/list`, `tools/call`

示例（取 quote）：

```bash
curl -s http://127.0.0.1:5173/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

curl -s http://127.0.0.1:5173/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

curl -s http://127.0.0.1:5173/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"allhuman_get_quote","arguments":{"response_format":"json"}}}'
```

## 数据落盘

`POST /api/join` 与 `POST /api/request` 会把提交内容写入 `data/*.json`。
