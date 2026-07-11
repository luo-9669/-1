# 流程通本地开发说明

## 启动

```bash
npm run install:all
npm run dev:all
```

- 前台产品工作台：http://localhost:5588
- 后端 API / 后台管理台：http://localhost:5599

## 当前发布门禁

默认测试命令只覆盖当前有效产品方向，重点保护高级 UX Markdown-first 流程、统一 Agent、画布导入、workspace hydration、系统 Skill 和联网 Evidence Pack。

```bash
npm test
npm run build
git diff --check
```

`npm test` 当前执行：

```bash
node --test tests/workflow-agent-actions.test.mjs backend/routes/workspace.test.js tests/system-skills.test.mjs tests/web-evidence-search.test.mjs
```

## 本地数据边界

不要提交本地运行数据或生成产物：

- `.git/`
- `node_modules/`
- `dist/`
- `backend/storage/workspace/*.json`
- `backend/storage/workspace/generated-images/`
- `backend/storage/auth-states/`
- 日志、临时文件和个人导出包
