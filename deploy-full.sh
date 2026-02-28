#!/bin/bash
#
# AI Interview Coach — 一键部署脚本
#
# 用法:
#   ./deploy-full.sh --domain example.com --email admin@example.com
#
# 功能:
#   1. 安装 Docker + Docker Compose（如未安装）
#   2. 停止旧 systemd 服务（如存在）
#   3. 拉取最新代码
#   4. 配置 .env
#   5. 构建并启动所有容器（postgres, backend, frontend, nginx）
#   6. 申请 Let's Encrypt SSL 证书
#   7. 切换到 HTTPS 配置并重载 nginx
#   8. 设置证书自动续期
#

set -e

# ============================================================
# 颜色和工具函数
# ============================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step()  { echo -e "\n${CYAN}========== $1 ==========${NC}"; }

# ============================================================
# 参数解析
# ============================================================
DOMAIN=""
EMAIL=""
PROJECT_DIR="/opt/ai_interviewer"
BRANCH="main"
GIT_REPO=""  # 填入你的 git 仓库地址
SKIP_SSL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)  DOMAIN="$2";  shift 2 ;;
        --email)   EMAIL="$2";   shift 2 ;;
        --dir)     PROJECT_DIR="$2"; shift 2 ;;
        --branch)  BRANCH="$2";  shift 2 ;;
        --repo)    GIT_REPO="$2"; shift 2 ;;
        --skip-ssl) SKIP_SSL=true; shift ;;
        *) error "未知参数: $1" ;;
    esac
done

if [ -z "$DOMAIN" ]; then
    read -p "请输入域名 (如 example.com): " DOMAIN
fi
if [ -z "$EMAIL" ] && [ "$SKIP_SSL" = false ]; then
    read -p "请输入邮箱 (用于 Let's Encrypt 证书): " EMAIL
fi

info "域名: $DOMAIN"
info "项目目录: $PROJECT_DIR"

# ============================================================
# Step 1: 安装 Docker
# ============================================================
step "Step 1/8: 检查并安装 Docker"

if command -v docker &> /dev/null; then
    info "Docker 已安装: $(docker --version)"
else
    info "安装 Docker..."
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "centos" || "$ID" == "alinux" || "$ID" == "rhel" || "$ID" == "aliyun" ]]; then
            yum install -y yum-utils
            yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        elif [[ "$ID" == "ubuntu" || "$ID" == "debian" ]]; then
            apt-get update
            apt-get install -y ca-certificates curl gnupg
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$ID/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        else
            error "不支持的操作系统: $ID，请手动安装 Docker"
        fi
    else
        error "无法检测操作系统"
    fi
    systemctl enable docker
    systemctl start docker
    info "Docker 安装完成"
fi

# 确认 docker compose 可用
if docker compose version &> /dev/null; then
    info "Docker Compose 可用: $(docker compose version)"
else
    error "Docker Compose 不可用，请检查 Docker 安装"
fi

# ============================================================
# Step 2: 停止旧服务
# ============================================================
step "Step 2/8: 停止旧服务"

if systemctl is-active --quiet ai-interviewer.service 2>/dev/null; then
    warn "检测到旧的 systemd 服务，正在停止..."
    systemctl stop ai-interviewer.service
    systemctl disable ai-interviewer.service
    info "旧服务已停止并禁用"
else
    info "未检测到旧的 systemd 服务"
fi

# ============================================================
# Step 3: 获取/更新代码
# ============================================================
step "Step 3/8: 获取最新代码"

if [ -d "$PROJECT_DIR/.git" ]; then
    info "项目已存在，拉取最新代码..."
    cd "$PROJECT_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    if [ -z "$GIT_REPO" ]; then
        error "项目目录不存在且未指定 --repo 参数。请用 --repo <git_url> 指定仓库地址"
    fi
    info "克隆项目..."
    git clone -b "$BRANCH" "$GIT_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

info "当前版本: $(git log --oneline -1)"

# ============================================================
# Step 4: 配置 .env
# ============================================================
step "Step 4/8: 配置环境变量"

if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        warn ".env 文件已从 .env.example 创建，请编辑填入实际值:"
        warn "  vim $PROJECT_DIR/.env"
        warn ""
        warn "必填项:"
        warn "  - POSTGRES_PASSWORD"
        warn "  - SECRET_KEY / JWT_SECRET_KEY"
        warn "  - DEEPSEEK_API_KEY (或其他 LLM API Key)"
        warn "  - DASHSCOPE_API_KEY"
        warn "  - ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET"
        warn ""
        read -p "是否现在编辑 .env? [Y/n] " edit_env
        if [[ "$edit_env" != "n" && "$edit_env" != "N" ]]; then
            ${EDITOR:-vi} "$PROJECT_DIR/.env"
        fi
    else
        error "找不到 .env.example，无法创建 .env"
    fi
fi

# 更新 .env 中的域名相关变量
info "更新 .env 中的域名配置..."
# 更新或添加 CORS_ORIGINS
if grep -q "^CORS_ORIGINS=" "$PROJECT_DIR/.env"; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN|" "$PROJECT_DIR/.env"
else
    echo "CORS_ORIGINS=https://$DOMAIN" >> "$PROJECT_DIR/.env"
fi
# 更新或添加 NEXT_PUBLIC_API_URL
if grep -q "^NEXT_PUBLIC_API_URL=" "$PROJECT_DIR/.env"; then
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://$DOMAIN|" "$PROJECT_DIR/.env"
else
    echo "NEXT_PUBLIC_API_URL=https://$DOMAIN" >> "$PROJECT_DIR/.env"
fi
# 添加 NEXT_PUBLIC_WS_URL
if grep -q "^NEXT_PUBLIC_WS_URL=" "$PROJECT_DIR/.env"; then
    sed -i "s|^NEXT_PUBLIC_WS_URL=.*|NEXT_PUBLIC_WS_URL=wss://$DOMAIN|" "$PROJECT_DIR/.env"
else
    echo "NEXT_PUBLIC_WS_URL=wss://$DOMAIN" >> "$PROJECT_DIR/.env"
fi

info ".env 配置完成"

# ============================================================
# Step 5: 配置 nginx（先用 HTTP-only 启动）
# ============================================================
step "Step 5/8: 配置 Nginx"

# 用初始 HTTP-only 配置启动（用于 certbot 验证）
cp "$PROJECT_DIR/nginx/nginx-init.conf" "$PROJECT_DIR/nginx/nginx-active.conf"
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx/nginx-active.conf"

# 准备 HTTPS 配置（稍后切换）
cp "$PROJECT_DIR/nginx/nginx.conf" "$PROJECT_DIR/nginx/nginx-ssl.conf"
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx/nginx-ssl.conf"

info "Nginx 配置已生成 (域名: $DOMAIN)"

# ============================================================
# Step 6: 构建并启动容器
# ============================================================
step "Step 6/8: 构建并启动 Docker 容器"

cd "$PROJECT_DIR"

# 临时将 nginx volume 指向 init 配置
# 修改 docker-compose 中的 nginx conf 映射
export COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# 先用 init 配置启动
sed -i "s|./nginx/nginx.conf:/etc/nginx/nginx.conf:ro|./nginx/nginx-active.conf:/etc/nginx/nginx.conf:ro|" docker-compose.yml

info "构建镜像（首次可能需要几分钟）..."
docker compose build

info "启动容器..."
docker compose up -d

# 等待服务就绪
info "等待服务启动..."
sleep 10

# 检查容器状态
if docker compose ps | grep -q "Up"; then
    info "容器启动成功"
    docker compose ps
else
    error "容器启动失败，请检查日志: docker compose logs"
fi

# ============================================================
# Step 7: 申请 SSL 证书
# ============================================================
step "Step 7/8: 申请 SSL 证书"

if [ "$SKIP_SSL" = true ]; then
    warn "跳过 SSL 证书申请 (--skip-ssl)"
else
    # 创建 certbot 所需目录
    docker volume create --name ai-interviewer_certbot_conf 2>/dev/null || true
    docker volume create --name ai-interviewer_certbot_www 2>/dev/null || true

    info "通过 certbot 申请 Let's Encrypt 证书..."
    docker run --rm \
        -v ai-interviewer_certbot_conf:/etc/letsencrypt \
        -v ai-interviewer_certbot_www:/var/www/certbot \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    if [ $? -eq 0 ]; then
        info "SSL 证书申请成功"

        # 切换到 HTTPS 配置
        cp "$PROJECT_DIR/nginx/nginx-ssl.conf" "$PROJECT_DIR/nginx/nginx-active.conf"
        docker compose exec nginx nginx -s reload
        info "Nginx 已切换到 HTTPS 模式"
    else
        warn "SSL 证书申请失败，保持 HTTP 模式运行"
        warn "你可以稍后手动运行 certbot 重试"
    fi

    # 设置自动续期 cron
    CRON_CMD="0 3 * * * docker run --rm -v ai-interviewer_certbot_conf:/etc/letsencrypt -v ai-interviewer_certbot_www:/var/www/certbot certbot/certbot renew --quiet && cd $PROJECT_DIR && docker compose exec -T nginx nginx -s reload"
    if ! crontab -l 2>/dev/null | grep -q "certbot/certbot renew"; then
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        info "已设置证书自动续期 (每天凌晨3点检查)"
    else
        info "证书自动续期 cron 已存在"
    fi
fi

# ============================================================
# Step 8: 完成
# ============================================================
step "Step 8/8: 部署完成"

echo ""
info "所有服务状态:"
docker compose ps
echo ""

if [ "$SKIP_SSL" = true ]; then
    info "访问地址: http://$DOMAIN"
else
    info "访问地址: https://$DOMAIN"
fi
info "后端 API:  https://$DOMAIN/api/"
info "WebSocket: wss://$DOMAIN/ws/"
echo ""
info "常用命令:"
info "  查看日志:     cd $PROJECT_DIR && docker compose logs -f"
info "  查看后端日志: cd $PROJECT_DIR && docker compose logs -f backend"
info "  重启服务:     cd $PROJECT_DIR && docker compose restart"
info "  停止服务:     cd $PROJECT_DIR && docker compose down"
info "  更新部署:     cd $PROJECT_DIR && git pull && docker compose build && docker compose up -d"
echo ""
echo -e "${GREEN}部署完成！${NC}"
