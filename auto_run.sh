#!/bin/bash
# Cooking-Plan Docker 部署管理脚本
# 用法: ./auto_run.sh {start|stop|restart|status|logs|update|backup|restore|cron|help}

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目名称（用于 Docker Compose 前缀）
PROJECT_NAME="cooking_plan"

# Cron 任务标识（用于在 crontab 中识别本项目的任务）
CRON_MARKER="# COOKING_PLAN_AUTO_UPDATE"

# 默认每天凌晨 4 点自动更新（避开 3 点的备份）
CRON_SCHEDULE="0 4 * * *"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 日志输出（带时间戳）
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检查必要文件
check_requirements() {
    if [ ! -f "docker-compose.prod.yml" ]; then
        print_error "docker-compose.prod.yml 文件不存在！"
        exit 1
    fi

    if [ ! -f ".env" ]; then
        print_warning ".env 文件不存在，正在从 .env.example 创建..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "请编辑 .env 文件设置正确的配置值后重新运行！"
            exit 1
        else
            print_error ".env.example 文件不存在！"
            exit 1
        fi
    fi

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 获取 Docker Compose 命令（指定生产配置文件）
get_docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose -f docker-compose.prod.yml"
    else
        echo "docker-compose -f docker-compose.prod.yml"
    fi
}

# ============ Cron 自动更新管理 ============

# 添加 cron 任务
setup_cron() {
    # 检查是否已安装 crontab
    if ! command -v crontab &> /dev/null; then
        print_warning "crontab 未安装，跳过自动更新配置"
        print_info "如需自动更新，请安装：sudo apt install cron"
        return 0
    fi

    # 如果已有任务，先移除
    remove_cron >/dev/null 2>&1 || true

    # 构造 cron 任务（静默模式 + 日志输出）
    local cron_task="$CRON_SCHEDULE cd $SCRIPT_DIR && ./auto_run.sh update --cron >> logs/cron.log 2>&1 $CRON_MARKER"

    # 添加到 crontab
    (crontab -l 2>/dev/null; echo "$cron_task") | crontab -

    print_success "已启用每日自动更新（$CRON_SCHEDULE）"
    print_info "日志：tail -f $SCRIPT_DIR/logs/cron.log"
    print_info "查看任务：crontab -l | grep COOKING_PLAN"
}

# 移除 cron 任务
remove_cron() {
    if ! command -v crontab &> /dev/null; then
        return 0
    fi

    # 过滤掉本项目的任务
    crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab - 2>/dev/null || true

    if [ "$1" != "--silent" ]; then
        print_success "已禁用每日自动更新"
    fi
}

# ============ 核心命令 ============

# 启动服务
start() {
    print_info "启动 Cooking-Plan 服务..."

    check_requirements

    COMPOSE_CMD=$(get_docker_compose_cmd)

    # 创建必要的目录
    mkdir -p backups logs

    # 构建并启动
    $COMPOSE_CMD -p $PROJECT_NAME build
    $COMPOSE_CMD -p $PROJECT_NAME up -d

    # 启用每日自动更新
    setup_cron

    print_success "服务启动成功！"
    echo ""
    print_info "访问地址: http://localhost:3000"
    print_info "查看状态: ./auto_run.sh status"
    print_info "查看日志: ./auto_run.sh logs"
    print_info "自动更新: 每天 $CRON_SCHEDULE 自动拉取最新代码"
}

# 停止服务
stop() {
    print_info "停止 Cooking-Plan 服务..."

    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME down

    # 移除自动更新任务
    remove_cron

    print_success "服务已停止（数据卷保留）"
}

# 重启服务
restart() {
    print_info "重启 Cooking-Plan 服务..."
    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME restart
    print_success "重启完成"
}

# 查看状态
status() {
    print_info "服务运行状态："
    echo ""

    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME ps

    echo ""
    print_info "容器资源使用："
    docker stats --no-stream $(docker ps -q --filter "name=$PROJECT_NAME") 2>/dev/null || \
        print_warning "没有运行中的容器"

    # 显示 cron 任务状态
    echo ""
    if command -v crontab &> /dev/null; then
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            print_info "自动更新：✓ 已启用（$(crontab -l | grep "$CRON_MARKER" | awk '{print $1, $2, $3, $4, $5}' | head -1)）"
        else
            print_info "自动更新：✗ 未启用"
        fi
    fi
}

# 查看日志
logs() {
    COMPOSE_CMD=$(get_docker_compose_cmd)

    if [ -n "$1" ]; then
        $COMPOSE_CMD -p $PROJECT_NAME logs -f "$1"
    else
        $COMPOSE_CMD -p $PROJECT_NAME logs -f
    fi
}

# 更新部署
# 用法: update [--cron]
#   --cron: 静默模式（cron 调用），减少输出
update() {
    local silent=false
    if [ "$1" = "--cron" ]; then
        silent=true
    fi

    if [ "$silent" = false ]; then
        print_info "更新 Cooking-Plan 部署..."
    else
        log "===== Cron 自动更新开始 ====="
    fi

    # 检查是否是 Git 仓库
    if [ ! -d ".git" ]; then
        if [ "$silent" = false ]; then
            print_warning "不是 Git 仓库，无法自动更新"
        else
            log "[SKIP] 不是 Git 仓库，跳过更新"
        fi
        return 0
    fi

    # 拉取最新代码（fetch + 比较差异，避免无变更时浪费资源）
    if [ "$silent" = false ]; then
        print_info "检查远程仓库更新..."
    fi

    git fetch origin master >/dev/null 2>&1

    LOCAL_HASH=$(git rev-parse HEAD)
    REMOTE_HASH=$(git rev-parse origin/master)

    if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
        if [ "$silent" = false ]; then
            print_success "已是最新版本，无需更新"
        else
            log "[SKIP] 已是最新版本（$LOCAL_HASH）"
            log "===== Cron 自动更新结束 ====="
        fi
        return 0
    fi

    if [ "$silent" = false ]; then
        print_info "发现新提交，开始更新..."
        print_info "  本地: $LOCAL_HASH"
        print_info "  远程: $REMOTE_HASH"
    else
        log "[UPDATE] 检测到新提交"
        log "  本地: $LOCAL_HASH"
        log "  远程: $REMOTE_HASH"
    fi

    # 拉取最新代码
    git pull origin master

    # 备份数据库（更新前保护数据）
    if [ "$silent" = false ]; then
        print_info "备份数据库..."
    else
        log "[BACKUP] 备份数据库..."
    fi
    backup_auto --silent

    # 停止旧服务
    if [ "$silent" = false ]; then
        print_info "停止当前服务..."
    fi
    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME down

    # 重新构建并启动
    if [ "$silent" = false ]; then
        print_info "重新构建并启动服务..."
    else
        log "[BUILD] 重新构建镜像..."
    fi
    $COMPOSE_CMD -p $PROJECT_NAME build
    $COMPOSE_CMD -p $PROJECT_NAME up -d

    # 清理旧镜像
    docker image prune -f >/dev/null 2>&1

    if [ "$silent" = false ]; then
        print_success "更新完成！"
    else
        log "[DONE] 更新完成，已重启服务"
        log "===== Cron 自动更新结束 ====="
    fi
}

# ============ 备份与恢复 ============

# 备份数据库
backup() {
    backup_auto
}

backup_auto() {
    local silent=false
    if [ "$1" = "--silent" ]; then
        silent=true
    fi

    if [ "$silent" = false ]; then
        print_info "备份 Postgres 数据..."
    fi

    COMPOSE_CMD=$(get_docker_compose_cmd)
    mkdir -p backups

    # 生成备份文件名
    BACKUP_FILE="backups/cooking_plan_$(date +%Y%m%d_%H%M%S).sql"

    # 获取数据库配置
    DB_NAME="${DB_NAME:-cooking_plan}"
    DB_USER="${DB_USER:-cooking_user}"
    if [ -f ".env" ]; then
        DB_NAME=$(grep -E "^DB_NAME=" .env | cut -d '=' -f2 || echo "cooking_plan")
        DB_USER=$(grep -E "^DB_USER=" .env | cut -d '=' -f2 || echo "cooking_user")
    fi

    # 执行备份（兼容两种容器命名格式）
    if docker exec ${PROJECT_NAME}_db_1 pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE" 2>/dev/null; then
        :
    elif docker exec ${PROJECT_NAME}-db-1 pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE" 2>/dev/null; then
        :
    else
        if [ "$silent" = false ]; then
            print_error "备份失败，请确保数据库正在运行"
        fi
        rm -f "$BACKUP_FILE"
        return 1
    fi

    # 压缩
    gzip "$BACKUP_FILE"

    if [ "$silent" = false ]; then
        print_success "备份成功: ${BACKUP_FILE}.gz"
    fi

    # 清理 30 天前的备份
    find backups -name "cooking_plan_*.sql.gz" -mtime +30 -delete 2>/dev/null

    return 0
}

# 恢复数据库
restore() {
    if [ -z "$1" ]; then
        print_error "请指定备份文件: ./auto_run.sh restore <backup-file.gz>"
        exit 1
    fi

    BACKUP_FILE="$1"

    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi

    print_warning "恢复操作会覆盖当前数据库，是否继续？(y/N)"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_info "已取消"
        exit 0
    fi

    print_info "停止服务..."
    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME down

    print_info "恢复数据库..."
    gunzip -c "$BACKUP_FILE" | docker run -i --rm \
        -v ${PROJECT_NAME}_postgres_data:/data \
        postgres:15-alpine psql -U cooking_user cooking_plan

    print_success "恢复完成，正在启动服务..."
    $COMPOSE_CMD -p $PROJECT_NAME up -d
}

# ============ 帮助 ============

help() {
    cat <<EOF
Cooking-Plan Docker 部署管理脚本

用法: ./auto_run.sh {start|stop|restart|status|logs|update|backup|restore|help}

命令说明:
  start              启动服务 + 启用每日自动更新（每天 04:00 拉取最新代码）
  stop               停止服务 + 禁用自动更新（数据卷保留）
  restart            重启服务（不改变 cron 配置）
  status             查看服务状态 + 自动更新状态
  logs [服务名]      查看日志（app / db，不指定看全部）
  update [--cron]    手动更新：git pull + 备份 + 重建 + 重启
                     --cron 静默模式（cron 调用用，有变更才更新）
  backup             手动备份数据库
  restore <file>     从备份恢复数据库
  help               显示此帮助

自动更新机制:
  - start 时自动添加 cron 任务（每天 04:00）
  - cron 调用 update --cron，检测到新提交才更新
  - 更新前自动备份数据库
  - 日志：logs/cron.log
  - stop 时自动移除 cron 任务

示例:
  ./auto_run.sh start                          # 启动 + 启用自动更新
  ./auto_run.sh update                         # 手动更新
  ./auto_run.sh logs app                       # 查看应用日志
  ./auto_run.sh restore backups/xxx.sql.gz     # 恢复备份
  crontab -l | grep COOKING_PLAN               # 查看自动更新任务
EOF
}

# ============ 主逻辑 ============

case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    update)
        update "$2"
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "未知命令: $1"
        help
        exit 1
        ;;
esac
