#!/bin/bash
# _common.sh - 훅 공통 유틸 (런던_디스패치)
# resolve_python: 실행 가능한 python 인터프리터 이름을 stdout으로. 없으면 1.
#   WindowsApps의 Store 스텁은 `import sys` 프로브에 실패해 후보에서 탈락한다.
resolve_python() {
    local c
    for c in python python3 py; do
        if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys" >/dev/null 2>&1; then
            printf '%s' "$c"; return 0
        fi
    done
    return 1
}

# marker_dir: 세션당 1회 알림용 마커 폴더. Windows Git Bash는 /tmp가 없을 수 있어 $TEMP를 우선한다.
marker_dir() {
    local base="${TEMP:-${TMP:-/tmp}}"
    base="${base//\\//}"
    printf '%s/%s' "$base" "$1"
}

# emit_context: PostToolUse 리마인더를 모델에게 전달한다.
#   stderr + exit 0 은 모델 컨텍스트에 들어가지 않으므로 hookSpecificOutput.additionalContext JSON으로 낸다.
#   인자: 메시지 1개(한국어). JSON 이스케이프는 python에 맡긴다.
emit_context() {
    local msg="$1"
    local py
    py=$(resolve_python) || { echo "$msg" >&2; return 0; }
    printf '%s' "$msg" | "$py" -c "
import sys, json
m = sys.stdin.read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': m}}, ensure_ascii=False))
"
}
