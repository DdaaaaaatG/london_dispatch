#!/bin/bash
# ld-contract-sync-reminder.sh - PostToolUse Hook (Edit|Write)
# contract 계층 4자(shared/src · server/src/routes · ui/src/api · doc/handoff) 수정 시
# 단일 소스 doc/200_설계/contract/api.md 와 나머지 세 곳 대조를 안내한다.
# 세션당 1회만 알린다. 마커: $TEMP/ld-contract-sync/{session_id}
# 모델에게 전달되도록 hookSpecificOutput.additionalContext(JSON, stdout)로 낸다.
# Exit codes: 0 = 항상 허용 (알림만)

INPUT=$(cat)

. "$(dirname "$0")/_common.sh"
PY=$(resolve_python) || exit 0
MARKER_DIR=$(marker_dir "ld-contract-sync")

RESULT=$(echo "$INPUT" | MARKER_DIR="$MARKER_DIR" "$PY" -c "
import sys, json, os, re

try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if d.get('tool_name', '') not in ('Edit', 'Write', 'MultiEdit'):
    sys.exit(0)

fp = ((d.get('tool_input') or {}).get('file_path') or '').replace('\\\\', '/')
if not fp:
    sys.exit(0)

m = re.search(r'(^|/)(shared/src|server/src/routes|ui/src/api|doc/handoff)/', fp)
if not m:
    sys.exit(0)
side = m.group(2)
# 코드 쪽은 .md 제외, handoff 는 .md 가 본체라 포함
if side != 'doc/handoff' and fp.endswith(('.md', '.markdown')):
    sys.exit(0)

sid = d.get('session_id', 'unknown')
mdir = os.environ.get('MARKER_DIR') or '/tmp/ld-contract-sync'
os.makedirs(mdir, exist_ok=True)
marker = os.path.join(mdir, sid)
if os.path.exists(marker):
    sys.exit(0)
open(marker, 'w').close()
print(side)
" 2>/dev/null)

case "$RESULT" in
    shared/src)
        emit_context "[ld] contract 계약이 바뀌었을 수 있습니다(shared/src). 단일 소스 doc/200_설계/contract/api.md 와 server/src/routes/, ui/src/api/, doc/handoff/ 를 대조하세요(contract-analyst 또는 /doc-sync)." ;;
    server/src/routes)
        emit_context "[ld] contract 계약이 바뀌었을 수 있습니다(server/src/routes). doc/200_설계/contract/api.md 와 shared/src/types.ts, ui/src/api/ 래퍼를 대조하세요. 라우트가 30줄을 넘으면 로직을 server 서비스로 옮깁니다." ;;
    ui/src/api)
        emit_context "[ld] contract 계약이 바뀌었을 수 있습니다(ui/src/api). doc/200_설계/contract/api.md 와 shared/src/types.ts, server/src/routes/ 를 대조하세요." ;;
    doc/handoff)
        emit_context "[ld] 갠홈 전달물(doc/handoff)이 바뀌었습니다. 토큰 형식·임베드 주소가 doc/200_설계/contract/api.md §토큰 및 server/src/auth/ 와 일치하는지 확인하고, 저쪽에 재전달이 필요하면 완료 보고에 적으세요." ;;
esac

exit 0
