#!/bin/bash

# AI Interview Coach 后端自动更新脚本
# 使用方法: ./deploy.sh

set -e  # 遇到错误立即退出

# 配置
PROJECT_DIR="/opt/AI_Interviewer"
SERVICE_NAME="ai-interviewer.service"
BRANCH="main"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AI Interview Coach 后端更新脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 进入项目目录
echo -e "\n${YELLOW}[1/5] 进入项目目录...${NC}"
cd $PROJECT_DIR
echo "当前目录: $(pwd)"

# 拉取最新代码
echo -e "\n${YELLOW}[2/5] 拉取最新代码...${NC}"
git fetch origin $BRANCH
git reset --hard origin/$BRANCH
echo "代码更新完成"

# 安装依赖
echo -e "\n${YELLOW}[3/5] 检查并安装依赖...${NC}"
cd backend
pip install -r requirements.txt --quiet
echo "依赖安装完成"

# 重启服务
echo -e "\n${YELLOW}[4/5] 重启服务...${NC}"
sudo systemctl restart $SERVICE_NAME
sleep 2

# 检查状态
echo -e "\n${YELLOW}[5/5] 检查服务状态...${NC}"
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
    systemctl status $SERVICE_NAME --no-pager | head -10
else
    echo -e "${RED}✗ 服务启动失败${NC}"
    echo "查看日志: journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"
