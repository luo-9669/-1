# Coze 端改动说明（给 Codex 看）

> 本文档记录 Coze 端为适配部署环境所做的所有改动，供 Codex 参考和配合。

## 一、部署架构

```
部署环境：Coze veFaaS（serverless）
运行端口：5000（固定）
文件系统：/opt/bytefaas/ 只读，/tmp 可写但重启丢失
数据库：Coze 内置 Supabase（PostgreSQL）
```

## 二、已完成的改动清单

### 2.1 项目初始化（commit: a349ca6）

| 文件 | 改动说明 |
|---|---|
| `.coze` | 根配置，定义 project/preview/dev/deploy/subprojects |
| `frontend/.coze` | 前端子项目配置 |
| `backend/.coze` | 后端子项目配置 |
| `AGENTS.md` | 项目规范文档 |
| `pnpm-workspace.yaml` | pnpm workspace 配置 |
| `package.json` | npm → pnpm 脚本迁移 |
| `scripts/start-dev.mjs` | npm → pnpm |

### 2.2 预览/部署脚本（commit: a349ca6 ~ 3b048cd）

| 文件 | 说明 |
|---|---|
| `scripts/coze-preview-build.sh` | 预览构建脚本 |
| `scripts/coze-preview-run.sh` | 预览运行脚本（Vite dev server on 5000） |
| `scripts/coze-deploy-build.sh` | 部署构建脚本（pnpm install + vite build） |
| `scripts/coze-deploy-run.sh` | 部署运行脚本（启动后端 on 5000） |

**关键逻辑**：
- `coze-deploy-run.sh` 设置 `STORAGE_ROOT=/tmp/liuchengtong-storage`
- 创建所有必需的存储子目录
- 导出 `WORKSPACE_STORE_FILE`、`WORKFLOW_GENERATED_IMAGE_DIR` 等环境变量

### 2.3 存储目录自动回退（commit: 710611a）

**问题**：部署环境 `/opt/bytefaas/` 只读，无法创建 `backend/storage`

**解决**：`backend/server/server-config.mjs` 新增 `resolveStorageRoot()` 函数：
```javascript
// 优先级：
// 1. STORAGE_ROOT 环境变量
// 2. backend/storage（如果可写）
// 3. /tmp/liuchengtong-storage（兜底）
```

**影响文件**：
- `backend/server/server-config.mjs` - 新增 `storageRoot` 导出
- `backend/server/mock-api.mjs` - 使用 `storageRoot` 配置路径
- `backend/routes/workflows.js` - 默认路径改用 `storageRoot`
- `backend/routes/workspace.js` - 默认路径改用 `storageRoot`
- `backend/services/competitor-analysis-engine-service.js` - 报告存储路径

### 2.4 静态文件服务（commit: a349ca6）

**问题**：部署时前后端需要合并到一个服务（端口 5000）

**解决**：
- 新增 `backend/server/static-file-server.mjs` - 静态文件服务模块
- 修改 `backend/server/api-handler.mjs` - 集成静态文件服务
- 未匹配 API 路由时，自动返回 `frontend/dist` 中的静态文件

### 2.5 数据库双模式存储（commit: 519cb41）⭐ 最新

**问题**：`/tmp` 重启丢数据，需要持久化存储

**解决**：
- 新增 `backend/services/database-store.mjs` - 数据库读写封装
- 新增 `backend/src/storage/database/supabase-client.mjs` - Supabase 客户端
- 修改 `backend/services/workspace-store.js` - 双模式加载逻辑

**双模式逻辑**：
```javascript
// workspace-store.js load() 函数：
// 1. 尝试从数据库加载（如果有 COZE_SUPABASE_URL）
// 2. 数据库加载失败 → 回退到本地 JSON
// 3. 本地 JSON 也不存在 → 使用空 workspace

// persistStore() 函数：
// 1. 先写本地 JSON（缓存）
// 2. 再尝试写数据库（持久化）
// 3. 数据库写入失败不阻塞（仅打印警告）
```

**数据库表结构**（已在 Coze Supabase 中创建）：
```sql
CREATE TABLE workspace_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**环境变量**：
| 变量 | 说明 | 来源 |
|---|---|---|
| `COZE_SUPABASE_URL` | Supabase 项目 URL | Coze 平台自动注入 |
| `COZE_SUPABASE_ANON_KEY` | Supabase 匿名 Key | Coze 平台自动注入 |
| `STORAGE_ROOT` | 本地存储根目录 | coze-deploy-run.sh 设置 |

## 三、Codex 需要配合的事项

### 3.1 代码层面

1. **不要修改以下文件的存储路径逻辑**（已由 Coze 端处理）：
   - `backend/server/server-config.mjs` 中的 `storageRoot`
   - `backend/services/workspace-store.js` 中的双模式加载逻辑
   - `scripts/coze-deploy-run.sh` 中的环境变量设置

2. **如果要新增存储路径**：
   - 使用 `storageRoot` 作为基础路径
   - 不要硬编码 `backend/storage` 或 `/tmp`

3. **数据库操作**：
   - 使用 `database-store.mjs` 中的函数
   - 不要直接操作 Supabase 客户端（已封装）

### 3.2 后续优化建议

| 优先级 | 事项 | 说明 |
|---|---|---|
| P1 | 大文件迁移到 OSS | 图片/PDF/HTML 不应存数据库或 /tmp |
| P2 | 表结构拆分 | 将 workspace_state JSON 拆为 users/projects/materials 等表 |
| P3 | 数据迁移脚本 | 将现有 JSON 数据导入数据库 |

## 四、协作规范

1. **以 GitHub origin/main 为唯一主线**
2. **改之前先拉最新**：`git pull --rebase origin main`
3. **推送前再同步一次**：`git pull --rebase origin main`
4. **不要用本地旧包互相覆盖**

## 五、当前状态

- ✅ 部署成功：https://liuchengtong.coze.site
- ✅ 数据库表已创建
- ✅ 双模式存储已集成
- ⏳ 等待验证：线上部署后数据库是否正常读写

---

*最后更新：2026-07-12*
*Coze 端提交：519cb41 feat: 添加 Supabase 数据库双模式存储*
