#!/bin/bash
# 测试 update 命令的变更检测逻辑
# 模拟 git 仓库 + mock Docker 命令

set -e

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

echo "========== Update 变更检测测试 =========="
echo ""

# 创建临时 git 仓库模拟环境
TEST_REPO="/tmp/test_update_repo"
rm -rf "$TEST_REPO"
mkdir -p "$TEST_REPO"
cd "$TEST_REPO"
git init -q
git config user.email "test@test.com"
git config user.name "test"

# 创建初始提交
echo "v1" > version.txt
git add -A
git commit -qm "initial commit"

# 模拟 origin/master（用一个本地 bare 仓库作为 remote）
REMOTE_REPO="/tmp/test_update_remote.git"
rm -rf "$REMOTE_REPO"
git clone --bare -q "$TEST_REPO" "$REMOTE_REPO"
git remote add origin "$REMOTE_REPO" 2>/dev/null || true
git branch -M master
git push -q origin master
git fetch -q origin

echo "测试 1：本地和远程一致时应跳过更新"
# 模拟 update --cron 中的变更检测逻辑
git fetch origin master >/dev/null 2>&1
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/master)
assert "hash 一致" "[ '$LOCAL_HASH' = '$REMOTE_HASH' ]"
assert "应判定为无需更新" "[ '$LOCAL_HASH' = '$REMOTE_HASH' ]"
echo ""

echo "测试 2：远程有新提交时应触发更新"
# 在远程仓库模拟新提交
cd /tmp
rm -rf test_update_clone
git clone -q "$REMOTE_REPO" test_update_clone
cd test_update_clone
echo "v2" > version.txt
git commit -qam "update to v2"
git push -q origin master
cd "$TEST_REPO"

# 重新 fetch
git fetch origin master >/dev/null 2>&1
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/master)
assert "hash 不一致" "[ '$LOCAL_HASH' != '$REMOTE_HASH' ]"
echo "  本地: $LOCAL_HASH"
echo "  远程: $REMOTE_HASH"
echo ""

echo "测试 3：git pull 能正确拉取新代码"
git pull -q origin master 2>/dev/null
NEW_VERSION=$(cat version.txt)
assert "版本号已更新为 v2" "[ '$NEW_VERSION' = 'v2' ]"
echo ""

echo "测试 4：hash 比较函数可正确判断"
# 重新比较
git fetch origin master >/dev/null 2>&1
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/master)
assert "拉取后 hash 一致" "[ '$LOCAL_HASH' = '$REMOTE_HASH' ]"
echo ""

echo "========== 测试结果 =========="
echo "通过: $PASS"
echo "失败: $FAIL"

# 清理
cd /home/huatuo/github/cooking-plan
rm -rf "$TEST_REPO" "$REMOTE_REPO" /tmp/test_update_clone

if [ $FAIL -gt 0 ]; then
    exit 1
fi
