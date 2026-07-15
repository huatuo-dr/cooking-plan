#!/bin/bash
# 测试 cron 管理逻辑（不依赖 Docker，不实际启动服务）
# 提取 auto_run.sh 中的 cron 相关函数进行独立测试

set -e

# 模拟 auto_run.sh 的环境
PROJECT_NAME="cooking_plan_test"
CRON_MARKER="# COOKING_PLAN_AUTO_UPDATE_TEST"
CRON_SCHEDULE="0 4 * * *"
SCRIPT_DIR="/tmp/test_cron_dir"
mkdir -p "$SCRIPT_DIR/logs"

# 提取 cron 管理函数（来自 auto_run.sh）
setup_cron() {
    if ! command -v crontab &> /dev/null; then
        echo "  crontab 未安装，跳过"
        return 0
    fi
    remove_cron >/dev/null 2>&1 || true
    local cron_task="$CRON_SCHEDULE cd $SCRIPT_DIR && ./auto_run.sh update --cron >> logs/cron.log 2>&1 $CRON_MARKER"
    (crontab -l 2>/dev/null; echo "$cron_task") | crontab -
    echo "  ✓ 已添加 cron 任务"
}

remove_cron() {
    if ! command -v crontab &> /dev/null; then
        return 0
    fi
    crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab - 2>/dev/null || true
    echo "  ✓ 已移除 cron 任务"
}

check_cron_exists() {
    if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
        return 0
    else
        return 1
    fi
}

# ============ 测试用例 ============

PASS=0
FAIL=0

assert() {
    local name="$1"
    local condition="$2"
    if eval "$condition"; then
        echo "  ✅ $name"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "========== Cron 管理逻辑测试 =========="
echo ""

# 测试 1：初始状态无任务
echo "测试 1：初始状态应该没有 cron 任务"
remove_cron >/dev/null 2>&1
assert "初始无任务" "! check_cron_exists"
echo ""

# 测试 2：添加任务后应该存在
echo "测试 2：setup_cron 后应该有任务"
setup_cron >/dev/null
assert "添加后有任务" "check_cron_exists"
echo ""

# 测试 3：重复添加不会产生多条（幂等）
echo "测试 3：重复添加应该是幂等的（不会有多条）"
setup_cron >/dev/null
setup_cron >/dev/null
setup_cron >/dev/null
COUNT=$(crontab -l 2>/dev/null | grep -c "$CRON_MARKER")
assert "只有 1 条任务（实际 $COUNT 条）" "[ $COUNT -eq 1 ]"
echo ""

# 测试 4：任务内容正确
echo "测试 4：任务内容应包含正确的时间和命令"
TASK=$(crontab -l 2>/dev/null | grep "$CRON_MARKER")
echo "  任务内容: $TASK"
assert "包含时间 '$CRON_SCHEDULE'" "echo '$TASK' | grep -q '$CRON_SCHEDULE'"
assert "包含 update --cron" "echo '$TASK' | grep -q 'update --cron'"
assert "包含日志输出" "echo '$TASK' | grep -q 'logs/cron.log'"
echo ""

# 测试 5：remove_cron 能正确移除
echo "测试 5：remove_cron 移除任务"
remove_cron >/dev/null
assert "移除后无任务" "! check_cron_exists"
echo ""

# 测试 6：remove_cron 不影响其他 cron 任务
echo "测试 6：remove_cron 不影响其他 cron 任务"
( echo "0 6 * * * /some/other/task"; ) | crontab -
setup_cron >/dev/null
remove_cron >/dev/null
OTHER_COUNT=$(crontab -l 2>/dev/null | grep -c "/some/other/task")
assert "保留了其他任务（$OTHER_COUNT 条）" "[ $OTHER_COUNT -eq 1 ]"
# 清理
crontab -r 2>/dev/null || true
echo ""

echo "========== 测试结果 =========="
echo "通过: $PASS"
echo "失败: $FAIL"
if [ $FAIL -gt 0 ]; then
    exit 1
fi
