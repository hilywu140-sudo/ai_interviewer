#!/bin/bash
#
# AI Interview Coach — 裸机一键部署脚本（无 Docker）
#
# 用法:
#   ./deploy-bare.sh --domain interviewgo.xin --email hilywu140@gmail.com
#
# 在阿里云 CentOS/Alibaba Cloud Linux 上部署：
#   PostgreSQL + 后端(uvicorn) + 前端(Next.js) + Nginx + HTTPS
#

set -e

# ============================================================
# 颜色
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
SKIP_SSL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)   DOMAIN="$2";  shift 2 ;;
        --email)    EMAIL="$2";   shift 2 ;;
        --dir)      PROJECT_DIR="$2"; shift 2 ;;
        --branch)   BRANCH="$2";  shift 2 ;;
        --skip-ssl) SKIP_SSL=true; shift ;;
        *) error "未知参数: $1" ;;
    esac
done

if [ -z "$DOMAIN" ]; then
    read -p "请输入域名 (如 example.com): " DOMAIN
fi
if [ -z "$EMAIL" ] && [ "$SKIP_SSL" = false ]; then
    read -p "请输入邮箱 (用于 Let's Encrypt): " EMAIL
fi

info "域名: $DOMAIN"
info "项目目录: $PROJECT_DIR"

# ============================================================
# Step 1: 安装系统依赖
# ============================================================
step "Step 1/9: 安装系统依赖"

# 检测包管理器
if command -v dnf &> /dev/null; then
    PKG_MGR="dnf"
elif command -v yum &> /dev/null; then
    PKG_MGR="yum"
else
    error "未找到 yum/dnf 包管理器"
fi

# 安装基础工具
$PKG_MGR install -y git curl wget gcc make openssl-devel bzip2-devel libffi-devel zlib-devel

info "系统依赖安装完成"

# ============================================================
# Step 2: 安装 Python 3.11
# ============================================================
step "Step 2/9: 检查 Python"

if python3.11 --version &> /dev/null; then
    info "Python 3.11 已安装: $(python3.11 --version)"
elif python3 --version 2>&1 | grep -q "3.1[1-9]"; then
    info "Python 已安装: $(python3 --version)"
    # 创建 python3.11 别名
    PYTHON_CMD="python3"
else
    info "安装 Python 3.11..."
    $PKG_MGR install -y python3.11 python3.11-pip python3.11-devel 2>/dev/null || {
        # 如果系统源没有，用 IUS 或编译安装
        warn "系统源没有 python3.11，尝试从源码编译..."
        cd /tmp
        wget https://mirrors.huaweicloud.com/python/3.11.9/Python-3.11.9.tgz
        tar xzf Python-3.11.9.tgz
        cd Python-3.11.9
        ./configure --enable-optimizations --prefix=/usr/local
        make -j$(nproc)
        make altinstall
        cd "$PROJECT_DIR"
    }
fi

# 确定 python 命令
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    error "Python 3.11+ 未找到"
fi
info "使用 Python: $($PYTHON_CMD --version)"

# ============================================================
# Step 3: 安装 Node.js 20
# ============================================================
step "Step 3/9: 检查 Node.js"

if command -v node &> /dev/null && node --version | grep -qE "v(2[0-9])\."; then
    info "Node.js 已安装: $(node --version)"
else
    info "安装 Node.js 20..."
    # 使用淘宝镜像源的 NodeSource
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || {
        # 备用：手动安装
        warn "NodeSource 安装失败，使用手动安装..."
        cd /tmp
        wget https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-linux-x64.tar.xz
        tar xf node-v20.18.0-linux-x64.tar.xz -C /usr/local --strip-components=1
    }
    $PKG_MGR install -y nodejs 2>/dev/null || true
fi

# 配置 npm 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
info "Node.js: $(node --version), npm: $(npm --version)"

# ============================================================
# Step 4: 安装 PostgreSQL
# ============================================================
step "Step 4/9: 检查 PostgreSQL"

if command -v psql &> /dev/null && systemctl is-active --quiet postgresql; then
    info "PostgreSQL 已运行"
else
    if ! command -v psql &> /dev/null; then
        info "安装 PostgreSQL 15..."
        $PKG_MGR install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm 2>/dev/null || true
        $PKG_MGR install -y postgresql15-server postgresql15 2>/dev/null || {
            # 备用：使用系统默认版本
            $PKG_MGR install -y postgresql-server postgresql
        }
    fi

    # 初始化并启动
    if [ -f /usr/pgsql-15/bin/postgresql-15-setup ]; then
        /usr/pgsql-15/bin/postgresql-15-setup initdb 2>/dev/null || true
        systemctl enable postgresql-15
        systemctl start postgresql-15
    else
        postgresql-setup initdb 2>/dev/null || true
        systemctl enable postgresql
        systemctl start postgresql
    fi
    info "PostgreSQL 已启动"
fi

# 创建数据库和用户（如果不存在）
info "检查数据库..."
# 从 .env 读取或使用默认值
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASS="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-ai_interviewer}"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    info "数据库 $DB_NAME 已创建"
}

# ============================================================
# Step 5: 安装 Nginx
# ============================================================
step "Step 5/9: 检查 Nginx"

if command -v nginx &> /dev/null; then
    info "Nginx 已安装"
else
    info "安装 Nginx..."
    $PKG_MGR install -y nginx
fi

systemctl enable nginx

# ============================================================
# Step 6: 拉取代码 & 配置
# ============================================================
step "Step 6/9: 更新代码"

if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    info "代码已更新: $(git log --oneline -1)"
else
    error "项目目录 $PROJECT_DIR 不存在。请先 git clone 你的仓库到该目录"
fi

# 检查 .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    warn ".env 已创建，请编辑填入 API Key 等配置: vim $PROJECT_DIR/.env"
    read -p "是否现在编辑? [Y/n] " edit_env
    if [[ "$edit_env" != "n" && "$edit_env" != "N" ]]; then
        ${EDITOR:-vi} "$PROJECT_DIR/.env"
    fi
fi

# 更新域名相关配置
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN|" "$PROJECT_DIR/.env"
grep -q "^NEXT_PUBLIC_API_URL=" "$PROJECT_DIR/.env" && \
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://$DOMAIN|" "$PROJECT_DIR/.env" || \
    echo "NEXT_PUBLIC_API_URL=https://$DOMAIN" >> "$PROJECT_DIR/.env"
grep -q "^NEXT_PUBLIC_WS_URL=" "$PROJECT_DIR/.env" && \
    sed -i "s|^NEXT_PUBLIC_WS_URL=.*|NEXT_PUBLIC_WS_URL=wss://$DOMAIN|" "$PROJECT_DIR/.env" || \
    echo "NEXT_PUBLIC_WS_URL=wss://$DOMAIN" >> "$PROJECT_DIR/.env"

info ".env 域名配置已更新"

# ============================================================
# Step 7: 部署后端
# ============================================================
step "Step 7/9: 部署后端"

cd "$PROJECT_DIR/backend"

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    info "创建 Python 虚拟环境..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate

# 配置 pip 使用阿里云镜像
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
pip config set global.trusted-host mirrors.aliyun.com

info "安装 Python 依赖..."
pip install -r requirements.txt --quiet

deactivate

# 加载 .env 变量用于数据库迁移
set -a
source "$PROJECT_DIR/.env"
set +a

# 创建 systemd 服务
info "配置 systemd 服务..."
cat > /etc/systemd/system/ai-interviewer-backend.service <<EOF
[Unit]
Description=AI Interviewer Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/backend
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=$PROJECT_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-interviewer-backend
systemctl restart ai-interviewer-backend

sleep 2
if systemctl is-active --quiet ai-interviewer-backend; then
    info "后端服务运行正常"
else
    error "后端启动失败，查看日志: journalctl -u ai-interviewer-backend -n 50"
fi

# ============================================================
# Step 8: 部署前端
# ============================================================
step "Step 8/9: 部署前端"

cd "$PROJECT_DIR/frontend"

info "安装前端依赖..."
npm ci --quiet

# 设置环境变量供 Next.js build 使用
export NEXT_PUBLIC_API_URL="https://$DOMAIN"
export NEXT_PUBLIC_WS_URL="wss://$DOMAIN"

info "构建前端（可能需要 1-2 分钟）..."
npm run build

# 创建 systemd 服务
cat > /etc/systemd/system/ai-interviewer-frontend.service <<EOF
[Unit]
Description=AI Interviewer Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=$(which node) $PROJECT_DIR/frontend/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-interviewer-frontend
systemctl restart ai-interviewer-frontend

sleep 2
if systemctl is-active --quiet ai-interviewer-frontend; then
    info "前端服务运行正常"
else
    error "前端启动失败，查看日志: journalctl -u ai-interviewer-frontend -n 50"
fi

# ============================================================
# Step 9: 配置 Nginx + HTTPS
# ============================================================
step "Step 9/9: 配置 Nginx + HTTPS"

# 停止旧的 systemd 服务（如果用的旧名字）
systemctl stop ai-interviewer.service 2>/dev/null || true
systemctl disable ai-interviewer.service 2>/dev/null || true

# 自动检测 nginx 配置目录
if [ -d "/www/server/nginx/conf" ]; then
    NGINX_CONF_DIR="/www/server/nginx/conf"
    info "检测到宝塔面板 Nginx: $NGINX_CONF_DIR"
elif [ -d "/etc/nginx/conf.d" ]; then
    NGINX_CONF_DIR="/etc/nginx/conf.d"
else
    NGINX_CONF_DIR="/etc/nginx/conf.d"
    mkdir -p "$NGINX_CONF_DIR"
fi

# 写 Nginx 配置（先 HTTP）
cat > "$NGINX_CONF_DIR/ai-interviewer.conf" <<'NGINX_EOF'
upstream frontend {
    server 127.0.0.1:3000;
}

upstream backend {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX_EOF

# 替换域名
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF_DIR/ai-interviewer.conf"

# 删除默认配置（避免冲突）
rm -f "$NGINX_CONF_DIR/default.conf" 2>/dev/null || true

# 如果是宝塔面板，确保主配置 include 了我们的配置
if [[ "$NGINX_CONF_DIR" == "/www/server/nginx/conf" ]]; then
    NGINX_MAIN_CONF="/www/server/nginx/conf/nginx.conf"
    if ! grep -q "ai-interviewer.conf" "$NGINX_MAIN_CONF"; then
        # 在 http { } 块最后一个 } 之前插入 include
        sed -i '/^}/i\    include '"$NGINX_CONF_DIR"'/ai-interviewer.conf;' "$NGINX_MAIN_CONF"
        info "已将 ai-interviewer.conf 加入 nginx 主配置"
    fi
fi

# 创建 certbot webroot 目录
mkdir -p /var/www/certbot

# 测试并重启 nginx
nginx -t && systemctl restart nginx
info "Nginx HTTP 配置完成"

# 申请 SSL 证书
if [ "$SKIP_SSL" = false ]; then
    info "安装 certbot..."
    $PKG_MGR install -y certbot python3-certbot-nginx 2>/dev/null || {
        pip3 install certbot certbot-nginx 2>/dev/null || true
    }

    if command -v certbot &> /dev/null; then
        info "申请 Let's Encrypt 证书..."
        certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --redirect

        if [ $? -eq 0 ]; then
            info "SSL 证书申请成功，HTTPS 已启用"

            # 手动添加 WebSocket 长连接超时到 HTTPS server block
            # certbot 会自动添加 HTTPS redirect 和 SSL 配置
            # 我们只需确保 ws location 有正确的超时设置
            nginx -t && systemctl reload nginx
        else
            warn "SSL 证书申请失败，网站仍可通过 HTTP 访问"
        fi

        # 设置自动续期
        if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
            (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
            info "已设置证书自动续期 (每天凌晨3点)"
        fi
    else
        warn "certbot 安装失败，请手动安装并申请证书"
    fi
fi

# ============================================================
# 完成
# ============================================================
step "部署完成"

echo ""
info "服务状态:"
echo "  后端: $(systemctl is-active ai-interviewer-backend)"
echo "  前端: $(systemctl is-active ai-interviewer-frontend)"
echo "  Nginx: $(systemctl is-active nginx)"
echo ""
if [ "$SKIP_SSL" = true ]; then
    info "访问地址: http://$DOMAIN"
else
    info "访问地址: https://$DOMAIN"
fi
echo ""
info "常用命令:"
info "  后端日志: journalctl -u ai-interviewer-backend -f"
info "  前端日志: journalctl -u ai-interviewer-frontend -f"
info "  重启后端: systemctl restart ai-interviewer-backend"
info "  重启前端: systemctl restart ai-interviewer-frontend"
info "  重启nginx: systemctl reload nginx"
echo ""
echo -e "${GREEN}部署完成！${NC}"
