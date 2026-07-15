#!/bin/bash
# 端到端测试 update --cron 流程
# Mock 掉 Docker 命令，验证完整流程

set -e

PASS=0
FAIL=0

assert() {
    if eval "$2"; then
        echo "  ✅ $1"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $1"
        FAIL=$((FAIL + 1))
    fi
}

echo "========== 端到端 Update 流程测试 =========="
echo ""

# 创建模拟的生产环境目录
DEPLOY_DIR="/tmp/test_deploy_e2e"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"/{logs,backups}
cd "$DEPLOY_DIR"

# 初始化为 git 仓库
git init -q
git config user.email "test@test.com"
git config user.name "test"

# 创建必要的文件
cp /home/huatuo/github/cooking-plan/auto_run.sh .
cp /home/huatuo/github/cooking-plan/docker-compose.prod.yml .
cat > .env <<EOF
DB_PASSWORD=test_password
JWT_SECRET=test_jwt_secret
ADMIN_EMAIL=test@test.com
ADMIN_PASSWORD=test123456
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EOF

# 创建远程仓库
REMOTE="/tmp/test_e2e_remote.git"
rm -rf "$REMOTE"
git clone --bare -q . "$REMOTE"
git remote add origin "$REMOTE"
git add -A
git commit -qm "initial deploy"
git push -q origin master 2>/dev/null
git fetch -q origin

# Mock docker 命令（让脚本认为 Docker 正在运行）
mkdir -p mock_bin
cat > mock_bin/docker <<'EOF'
#!/bin/bash
case "$1" in
    compose)
        case "$3" in
            ps)       echo "NAME                STATUS"; echo "cooking_plan_app   Up"; echo "cooking_plan_db    Up (healthy)";;
            down)     echo "[MOCK] Stopping containers";;
            build)    echo "[MOCK] Building images";;
            up)       echo "[MOCK] Starting containers";;
            restart)  echo "[MOCK] Restarting";;
            logs)     echo "[MOCK] Showing logs";;
            version)  echo "Docker Compose version v2.0.0";;
        esac
        ;;
    exec)
        echo "[MOCK] pg_dump output"
        ;;
    image)
        echo "[MOCK] Pruning images"
        ;;
    stats)
        echo "[MOCK] Container stats"
        ;;
esac
exit 0
EOF
chmod +x mock_bin/docker

# 把 mock docker 放到 PATH 前面
export PATH="$DEPLOY_DIR/mock_bin:$PATH"

echo "测试 1：update --cron 在无变更时应跳过"
output=$(./auto_run.sh update --cron 2>&1 || true)
if echo "$output" | grep -q "SKIP"; then
    echo "  ✅ 无变更时正确跳过"
    PASS=$((PASS + 1))
else
    echo "  ❌ 无变更时未正确跳过"
    echo "     输出: $output"
    FAIL=$((FAIL + 1))
fi
echo ""

echo "测试 2：远程有新提交时 update --cron 应执行更新"
# 在远程模拟新提交
cd /tmp
rm -rf e2e_clone
git clone -q "$REMOTE" e2e_clone
cd e2e_clone
echo "new feature" > feature.txt
git add -A
git commit -qm "add new feature"
git push -q origin master
cd "$DEPLOY_DIR"

output=$(./auto_run.sh update --cron 2>&1 || true)
if echo "$output" | grep -q "UPDATE"; then
    echo "  ✅ 检测到新提交并执行更新"
    PASS=$((PASS + 1))
else
    echo "  ❌ 未正确检测到新提交"
    echo "     输出: $output"
    FAIL=$((FAIL + 1))
fi

# 验证代码已拉取
if [ -f feature.txt ]; then
    echo "  ✅ 新代码已拉取"
    PASS=$((PASS + 1))
else
    echo "  ❌ 新代码未拉取"
    FAIL=$((FAIL + 1))
fi
echo ""

echo "测试 3：再次 update --cron 应跳过（已是最新）"
output=$(./auto_run.sh update --cron 2>&1 || true)
if echo "$output" | grep -q "SKIP"; then
    echo "  ✅ 已是最新时正确跳过"
    PASS=$((PASS + 1))
else
    echo "  ❌ 已是最新时未正确跳过"
    FAIL=$((FAIL + 1))
fi
echo ""

echo "========== 测试结果 =========="
echo "通过: $PASS"
echo "失败: $FAIL"

# 清理
cd /home/huatuo/github/cooking-plan
rm -rf "$DEPLOY_DIR" "$REMOTE" /tmp/e2e_clone

if [ $FAIL -gt 0 ]; then
    exit 1
fi
