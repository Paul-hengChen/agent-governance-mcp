#!/bin/bash
# dual-agent.sh
# 同時在兩個新 Terminal 視窗啟動 Claude 和 Gemini，並傳入相同的 prompt

# 顏色輸出
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Dual AI Agent Launcher             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# 取得 prompt：可以從參數傳入，也可以互動式輸入
if [ -n "$1" ]; then
    PROMPT="$*"
else
    echo -e "${GREEN}請輸入要給 AI Agent 的 Prompt:${NC}"
    echo -n "> "
    read -r PROMPT
fi

if [ -z "$PROMPT" ]; then
    echo "❌ Prompt 不能為空！"
    exit 1
fi

echo ""
echo -e "📋 Prompt: ${CYAN}${PROMPT}${NC}"
echo ""
echo "🚀 正在啟動 Claude 和 Antigravity..."

# 用 AppleScript 在同一個 iTerm2 視窗中 split 兩個 pane
osascript <<EOF
tell application "iTerm"
    activate

    -- 開啟新視窗，左邊跑 Claude
    set newWindow to (create window with default profile)
    tell current session of current tab of newWindow
        set name to "Claude Agent"
        write text "echo '🤖 Starting Claude...' && claude \"${PROMPT//\"/\\\"}\""

        -- 垂直分割，右邊跑 Antigravity
        set antigravitySession to (split vertically with default profile)
        tell antigravitySession
            set name to "Antigravity Agent"
            write text "echo '🤖 Starting Antigravity...' && agy -i \"${PROMPT//\"/\\\"}\""
        end tell
    end tell
end tell
EOF

echo ""
echo -e "${GREEN}✅ 已在同一視窗的兩個 pane 啟動！${NC}"
echo "   📌 Claude → 左邊 pane"
echo "   📌 Antigravity → 右邊 pane"
