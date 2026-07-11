#!/bin/zsh

cd "$(dirname "$0")" || exit 1

echo "正在启动流程通前后端..."
echo "项目目录：$(pwd)"
echo ""
echo "前端地址：http://localhost:5288/"
echo "后端地址：http://localhost:5299"
echo ""
echo "关闭这个终端窗口或按 Control+C 可以停止服务。"
echo ""

npm run dev:all

echo ""
echo "服务已停止。按任意键关闭窗口。"
read -k 1
