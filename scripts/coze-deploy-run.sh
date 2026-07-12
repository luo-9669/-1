#!/bin/bash
# 【Coze 端改动 - Codex 请注意】
# 这是 Coze 部署环境的运行脚本。
# Coze 部署环境 /opt/bytefaas/ 是只读文件系统，所以：
# 1. 存储目录使用 /tmp 下的可写目录
# 2. 后端同时提供 API 和静态文件服务（frontend/dist）
# 3. 监听端口固定为 5000（Coze 平台要求）
# 如果后续接入数据库，这里的 STORAGE_ROOT 主要用于大文件本地缓存。
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"
export PORT

# 清理 5000 端口残留进程（绝不碰 9000）
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

# 部署环境可能是只读文件系统，使用 /tmp 下的可写目录作为存储根目录
# 【注意】/tmp 在 serverless 环境重启后会丢失数据，
# 后续接入数据库后，这里只用于大文件（图片/PDF）的临时缓存
STORAGE_ROOT="/tmp/liuchengtong-storage"
export STORAGE_ROOT

mkdir -p "${STORAGE_ROOT}/workspace"
mkdir -p "${STORAGE_ROOT}/auth-states"
mkdir -p "${STORAGE_ROOT}/competitor-analysis"
mkdir -p "${STORAGE_ROOT}/generated-images"
mkdir -p "${STORAGE_ROOT}/material-previews"

# 通过环境变量将存储路径指向可写目录
export WORKSPACE_STORE_FILE="${STORAGE_ROOT}/workspace/workspace.local.json"
export WORKFLOW_GENERATED_IMAGE_DIR="${STORAGE_ROOT}/generated-images"
export WORKSPACE_MATERIAL_PREVIEW_DIR="${STORAGE_ROOT}/material-previews"

# 启动后端 API 服务（监听 5000 端口）
# 后端会同时提供 API 和静态文件服务
exec node backend/server/mock-api.mjs
