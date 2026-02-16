#!/bin/bash
# AI Interview Coach - 阿里云 ECS 部署脚本
# 适用于 Alibaba Cloud Linux / CentOS 7/8
# 使用 Cloudflare Tunnel 提供 HTTPS

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 配置变量
APP_DIR="/opt/ai_interviewer"
BACKEND_DIR="${APP_DIR}/backend"
DB_NAME="ai_interviewer"
DB_USER="ai_user"
DB_PASSWORD="$(openssl rand -hex 16)"

log_info "=========================================="
log_info "AI Interview Coach 部署脚本"
log_info "=========================================="

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 root 用户运行此脚本: sudo bash deploy.sh"
    exit 1
fi

# 检查 .env 文件
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    log_error ".env 文件不存在！"
    log_info "请先复制并编辑环境变量文件："
    log_info "  cp ${BACKEND_DIR}/deploy/.env.template ${BACKEND_DIR}/.env"
    log_info "  vim ${BACKEND_DIR}/.env"
    exit 1
fi

# ==================== 1. 系统依赖安装 ====================
log_info "安装系统依赖..."

# 检测包管理器
if command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
else
    log_error "不支持的系统，需要 dnf 或 yum"
    exit 1
fi

# 安装基础工具
$PKG_MANAGER install -y epel-release || true
$PKG_MANAGER install -y \
    git \
    curl \
    wget \
    gcc \
    gcc-c++ \
    make \
    openssl \
    openssl-devel \
    libffi-devel \
    zlib-devel \
    bzip2-devel \
    readline-devel \
    sqlite-devel

# ==================== 2. 安装 Python 3.11 ====================
log_info "检查 Python 版本..."

if command -v python3.11 &> /dev/null; then
    log_info "Python 3.11 已安装"
else
    log_info "安装 Python 3.11..."
    $PKG_MANAGER install -y python3.11 python3.11-devel python3.11-pip || {
        # 如果包管理器没有 Python 3.11，从源码编译
        log_warn "从源码编译 Python 3.11..."
        cd /tmp
        wget https://www.python.org/ftp/python/3.11.7/Python-3.11.7.tgz
        tar xzf Python-3.11.7.tgz
        cd Python-3.11.7
        ./configure --enable-optimizations --prefix=/usr/local
        make -j$(nproc)
        make altinstall
        ln -sf /usr/local/bin/python3.11 /usr/bin/python3.11
        ln -sf /usr/local/bin/pip3.11 /usr/bin/pip3.11
    }
fi

# ==================== 3. 安装 PostgreSQL ====================
log_info "安装 PostgreSQL..."

if command -v psql &> /dev/null; then
    log_info "PostgreSQL 已安装"
else
    # 安装 PostgreSQL
    $PKG_MANAGER install -y postgresql-server postgresql-contrib postgresql-devel

    # 初始化数据库
    if [ ! -d "/var/lib/pgsql/data" ] || [ -z "$(ls -A /var/lib/pgsql/data 2>/dev/null)" ]; then
        postgresql-setup --initdb || postgresql-setup initdb
    fi
fi

# 启动 PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# 创建数据库和用户
log_info "配置数据库..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || {
    sudo -u postgres psql <<EOF
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
    log_info "数据库创建成功"
    log_warn "数据库密码: ${DB_PASSWORD}"
    log_warn "请更新 .env 文件中的 DATABASE_URL"
}

# 配置 PostgreSQL 允许密码认证
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    if ! grep -q "ai_user" "$PG_HBA"; then
        sed -i '/^local.*all.*all/a local   ai_interviewer  ai_user                                 md5' "$PG_HBA"
        sed -i '/^host.*all.*all.*127/a host    ai_interviewer  ai_user         127.0.0.1/32            md5' "$PG_HBA"
        systemctl restart postgresql
    fi
fi

# ==================== 4. 创建应用用户 ====================
log_info "创建应用用户..."

if id "ai_interviewer" &>/dev/null; then
    log_info "用户 ai_interviewer 已存在"
else
    useradd -m -s /bin/bash ai_interviewer
    log_info "用户 ai_interviewer 创建成功"
fi

# ==================== 5. 配置 Python 虚拟环境 ====================
log_info "配置 Python 虚拟环境..."

cd "${BACKEND_DIR}"

# 创建虚拟环境
if [ ! -d "venv" ]; then
    python3.11 -m venv venv
fi

# 激活虚拟环境并安装依赖
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 创建必要目录
mkdir -p uploads/resumes
mkdir -p audio_files

# 设置权限
chown -R ai_interviewer:ai_interviewer "${APP_DIR}"
chmod 755 uploads uploads/resumes audio_files
chmod 600 .env

# ==================== 6. 安装 Cloudflare Tunnel ====================
log_info "安装 Cloudflare Tunnel..."

if command -v cloudflared &> /dev/null; then
    log_info "cloudflared 已安装"
else
    # 下载并安装 cloudflared
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    log_info "cloudflared 安装成功"
fi

# ==================== 7. 配置 systemd 服务 ====================
log_info "配置 systemd 服务..."

# 复制服务文件
cp "${BACKEND_DIR}/deploy/ai-interviewer.service" /etc/systemd/system/
cp "${BACKEND_DIR}/deploy/cloudflared.service" /etc/systemd/system/

# 重新加载 systemd
systemctl daemon-reload

# 启用并启动后端服务
systemctl enable ai-interviewer
systemctl start ai-interviewer

# 等待后端启动
sleep 3

# 检查后端状态
if systemctl is-active --quiet ai-interviewer; then
    log_info "后端服务启动成功"
else
    log_error "后端服务启动失败，请检查日志: journalctl -u ai-interviewer -f"
    exit 1
fi

# ==================== 8. 启动 Cloudflare Tunnel ====================
log_info "启动 Cloudflare Tunnel..."

# 启用并启动 Tunnel 服务
systemctl enable cloudflared
systemctl start cloudflared

# 等待 Tunnel 启动并获取 URL
sleep 5

log_info "=========================================="
log_info "部署完成！"
log_info "=========================================="
log_info ""
log_info "后端服务状态: systemctl status ai-interviewer"
log_info "Tunnel 服务状态: systemctl status cloudflared"
log_info ""
log_info "查看 Tunnel URL:"
log_info "  journalctl -u cloudflared | grep -i 'https://'"
log_info ""
log_info "或者手动运行获取 URL:"
log_info "  cloudflared tunnel --url http://127.0.0.1:8001"
log_info ""
log_warn "重要：获取 Tunnel URL 后，请更新以下配置："
log_warn "1. .env 文件中的 CORS_ORIGINS"
log_warn "2. Vercel 环境变量 NEXT_PUBLIC_API_URL 和 NEXT_PUBLIC_WS_URL"
log_info ""
log_info "常用命令："
log_info "  查看后端日志: journalctl -u ai-interviewer -f"
log_info "  查看 Tunnel 日志: journalctl -u cloudflared -f"
log_info "  重启后端: systemctl restart ai-interviewer"
log_info "  重启 Tunnel: systemctl restart cloudflared"
