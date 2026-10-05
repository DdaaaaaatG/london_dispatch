#!/bin/bash
# ld-design-sync-reminder.sh - PostToolUse Hook (Edit|Write)
# 화면 폴더(ui/src/rooms/, ui/src/chat/)와 ui/src/state/(→ chat 소속)의 .ts/.tsx 소스 수정 시
# design.md 동기화·CR 기록을 안내한다.
# test/ 하위, .test/.spec, 문서(.md)는 제외. 화면당 세션 1회. 마커: $TEMP/ld-design-sync/{session_id}-{screen}
# 모델에게 전달되도록 hookSpecificOutput.additionalContext(JSON, stdout)로 낸다.
# Exit codes: 0 = 항상 허용 (알림만)

INPUT=$(cat)

. "$(dirname "$0")/_common.sh"
PY=$(resolve_python) || exit 0
MARKER_DIR=$(marker_dir "ld-design-sync")

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

m = re.search(r'(^|/)ui/src/(rooms|chat|state)/(.+)$', fp)
if not m:
    sys.exit(0)
rest = m.group(3)
if rest.startswith('test/') or '/test/' in rest:
    sys.exit(0)
if not re.search(r'\.(ts|tsx)$', rest):
    sys.exit(0)
if re.search(r'\.(test|spec)\.(ts|tsx)$', rest):
    sys.exit(0)

screen = m.group(2)
if screen == 'state':
    screen = 'chat'
sid = d.get('session_id', 'unknown')
mdir = os.environ.get('MARKER_DIR') or '/tmp/ld-design-sync'
os.makedirs(mdir, exist_ok=True)
marker = os.path.join(mdir, f'{sid}-{screen}')
if os.path.exists(marker):
    sys.exit(0)
open(marker, 'w').close()
print(screen)
" 2>/dev/null)

if [[ -n "$RESULT" ]]; then
    emit_context "[ld] 화면 '${RESULT}' 소스가 바뀌었습니다. ui/src/${RESULT}/design.md 동기화(ui-designer) 또는 CR 대장(ui/src/${RESULT}/test/change-requests.md) 기록을 잊지 마세요. 기록 없이 완료 보고 금지."
fi

exit 0
