#!/bin/bash
# Cooking-Plan Docker 部署管理脚本
# 用法: ./auto_run.sh {start|stop|restart|status|logs|update|backup|help}

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目名称（用于 Docker Compose 前缀）
PROJECT_NAME="cooking_plan"

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

# 检查必要文件
check_requirements() {
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml 文件不存在！"
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

# 获取 Docker Compose 命令
get_docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# 启动服务
start() {
    print_info "启动 Cooking-Plan 服务..."

    check_requirements

    COMPOSE_CMD=$(get_docker_compose_cmd)

    # 创建必要的目录
    mkdir -p backups
    mkdir -p logs

    # 构建并启动
    $COMPOSE_CMD -p $PROJECT_NAME build
    $COMPOSE_CMD -p $PROJECT_NAME up -d

    print_success "服务启动成功！"
    echo ""
    print_info "访问地址: http://localhost:3000"
    print_info "查看状态: ./auto_run.sh status"
    print_info "查看日志: ./auto_run.sh logs"
}

# 停止服务
stop() {
    print_info "停止 Cooking-Plan 服务..."

    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME down

    print_success "服务已停止（数据卷保留）"
}

# 重启服务
restart() {
    print_info "重启 Cooking-Plan 服务..."
    stop
    sleep 2
    start
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
}

# 查看日志
logs() {
    COMPOSE_CMD=$(get_docker_compose_cmd)

    if [ -n "$1" ]; then
        # 查看指定服务的日志
        $COMPOSE_CMD -p $PROJECT_NAME logs -f "$1"
    else
        # 查看所有服务日志
        $COMPOSE_CMD -p $PROJECT_NAME logs -f
    fi
}

# 更新部署
update() {
    print_info "更新 Cooking-Plan 部署..."

    # 拉取最新代码
    if [ -d ".git" ]; then
        print_info "拉取最新代码..."
        git pull
    else
        print_warning "不是 Git 仓库，跳过代码拉取"
    fi

    # 停止服务
    print_info "停止当前服务..."
    COMPOSE_CMD=$(get_docker_compose_cmd)
    $COMPOSE_CMD -p $PROJECT_NAME down

    # 备份数据库
    print_info "备份数据库..."
    backup_auto

    # 重新构建并启动
    print_info "重新构建并启动服务..."
    $COMPOSE_CMD -p $PROJECT_NAME build
    $COMPOSE_CMD -p $PROJECT_NAME up -d

    # 清理旧镜像
    print_info "清理旧镜像..."
    docker image prune -f

    print_success "更新完成！"
}

# 备份数据库
backup() {
    backup_auto
}

backup_auto() {
    print_info "备份 Postgres 数据..."

    COMPOSE_CMD=$(get_docker_compose_cmd)

    # 确保备份目录存在
    mkdir -p backups

    # 生成备份文件名（带时间戳）
    BACKUP_FILE="backups/cooking_plan_$(date +%Y%m%d_%H%M%S).sql"

    # 获取数据库配置
    if [ -f ".env" ]; then
        DB_NAME=$(grep POSTGRES_DB .env | cut -d '=' -f2)
        DB_USER=$(grep POSTGRES_USER .env | cut -d '=' -f2)
    else
        DB_NAME="cooking_plan"
        DB_USER="cooking_user"
    fi

    # 执行备份
    docker exec ${PROJECT_NAME}_db_1 pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE" 2>/dev/null || \
        docker exec ${PROJECT_NAME}-db-1 pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE" 2>/dev/null

    if [ $? -eq 0 ]; then
        # 压缩备份文件
        gzip "$BACKUP_FILE"
        print_success "备份成功: ${BACKUP_FILE}.gz"

        # 清理 30 天前的备份
        find backups -name "cooking_plan_*.sql.gz" -mtime +30 -delete 2>/dev/null
        print_info "已清理 30 天前的旧备份"
    else
        print_error "备份失败，请确保数据库正在运行"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
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

    # 解压并恢复
    gunzip -c "$BACKUP_FILE" | docker run -i --rm \
        -v ${PROJECT_NAME}_postgres_data:/data \
        postgres:15-alpine psql -U cooking_user cooking_plan

    print_success "恢复完成，正在启动服务..."
    $COMPOSE_CMD -p $PROJECT_NAME up -d
}

# 显示帮助
help() {
    echo "Cooking-Plan Docker 部署管理脚本"
    echo ""
    echo "用法: ./auto_run.sh {start|stop|restart|status|logs|update|backup|restore|help}"
    echo ""
    echo "命令说明:"
    echo "  start    - 启动服务（首次运行会构建镜像）"
    echo "  stop     - 停止服务（数据卷保留）"
    echo "  restart  - 重启服务"
    echo "  status   - 查看服务运行状态"
    echo "  logs     - 查看服务日志（可指定服务名: logs app）"
    echo "  update   - 更新代码并重新部署"
    echo "  backup   - 备份 Postgres 数据库"
    echo "  restore  - 恢复数据库（需指定备份文件）"
    echo "  help     - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./auto_run.sh start          # 启动服务"
    echo "  ./auto_run.sh logs app       # 查看应用日志"
    echo "  ./auto_run.sh restore backups/cooking_plan_20260713_120000.sql.gz"
    echo ""
}

# 主逻辑
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
        update
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
