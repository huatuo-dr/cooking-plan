#!/bin/bash
# 测试错误处理逻辑（缺文件、无 env 等）

set +e  # 不要 exit on error，让测试捕获退出码

PASS=0
FAIL=0

assert_exit() {
    local name="$1"
    local expected_code="$2"
    shift 2
    "$@" >/dev/null 2>&1
    local actual_code=$?
    if [ "$actual_code" -eq "$expected_code" ]; then
        echo "  ✅ $name（exit $actual_code）"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $name（期望 exit $expected_code，实际 $actual_code）"
        FAIL=$((FAIL + 1))
    fi
}

assert_contains() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if echo "$actual" | grep -q "$expected"; then
        echo "  ✅ $name"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $name（输出中未找到 '$expected'）"
        echo "     输出: $actual"
        FAIL=$((FAIL + 1))
    fi
}

AUTO_RUN="/home/huatuo/github/cooking-plan/auto_run.sh"
TEST_DIR="/tmp/test_error_handling"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "========== 错误处理测试 =========="
echo ""

echo "测试 1：缺少 docker-compose.prod.yml 应失败"
# 复制脚本但缺少 compose 文件
cp "$AUTO_RUN" .
rm -f docker-compose.prod.yml .env
output=$(./auto_run.sh start 2>&1)
code=$?
assert_exit "exit 1" 1 true
assert_contains "提示缺少 compose 文件" "docker-compose.prod.yml" "$output"
echo ""

echo "测试 2：有 compose 但缺 .env 应自动创建并提示"
cp "$AUTO_RUN" .
cat > docker-compose.prod.yml <<EOF
services:
  db:
    image: postgres:15
EOF
cat > .env.example <<EOF
DB_PASSWORD=test
EOF
rm -f .env
output=$(./auto_run.sh start 2>&1)
code=$?
assert_exit "exit 1（提示编辑 .env）" 1 true
assert_contains "提示编辑 .env" "请编辑 .env" "$output"
# 验证 .env 已被创建
if [ -f .env ]; then
    echo "  ✅ .env 已自动创建"
    PASS=$((PASS + 1))
else
    echo "  ❌ .env 未被创建"
    FAIL=$((FAIL + 1))
fi
echo ""

echo "测试 3：restore 缺少参数应报错"
output=$(./auto_run.sh restore 2>&1)
code=$?
assert_exit "exit 1" 1 true
assert_contains "提示需要备份文件" "请指定备份文件" "$output"
echo ""

echo "测试 4：restore 不存在的文件应报错"
output=$(./auto_run.sh restore /nonexistent/backup.sql.gz 2>&1)
code=$?
assert_exit "exit 1" 1 true
assert_contains "提示文件不存在" "备份文件不存在" "$output"
echo ""

echo "========== 测试结果 =========="
echo "通过: $PASS"
echo "失败: $FAIL"

# 清理
cd /home/huatuo/github/cooking-plan
rm -rf "$TEST_DIR"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
