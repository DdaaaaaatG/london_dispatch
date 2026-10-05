#!/bin/bash
# ld-build-reminder.sh - PostToolUse Hook (Edit|Write)
# 빌드·배포·환경 설정 파일(package.json, wrangler.toml, vite.config.ts, tsconfig*.json, .dev.vars.example)과
# D1 마이그레이션(server/migrations/*.sql) 변경 시 재빌드·설정·마이그레이션 적용을 안내한다.
# 트리 어디에 있든(루트·server/·ui/·shared/) 잡는다.
# 세션당 1회. 마커: $TEMP/ld-build-reminder/{session_id}
# 모델에게 전달되도록 hookSpecificOutput.additionalContext(JSON, stdout)로 낸다.
# Exit codes: 0 = 항상 허용 (알림만)

INPUT=$(cat)

. "$(dirname "$0")/_common.sh"
PY=$(resolve_python) || exit 0
MARKER_DIR=$(marker_dir "ld-build-reminder")

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

if not re.search(r'(^|/)(package\.json|wrangler\.toml|vite\.config\.ts|tsconfig[^/]*\.json|\.dev\.vars\.example|migrations/[^/]+\.sql)$', fp):
    sys.exit(0)

sid = d.get('session_id', 'unknown')
mdir = os.environ.get('MARKER_DIR') or '/tmp/ld-build-reminder'
os.makedirs(mdir, exist_ok=True)
marker = os.path.join(mdir, sid)
if os.path.exists(marker):
    sys.exit(0)
open(marker, 'w').close()
print(os.path.basename(fp))
" 2>/dev/null)

if [[ -n "$RESULT" ]]; then
    case "$RESULT" in
        .dev.vars.example)
            emit_context "[ld] 로컬 비밀값 키 목록(server/.dev.vars.example)이 바뀌었습니다. server/src/env.ts 의 parseEnv 스키마, Cloudflare Secrets(wrangler secret put) 키 목록, wrangler.toml [vars], doc/handoff/(SECRET 전달)와 일치하는지 확인하세요." ;;
        wrangler.toml)
            emit_context "[ld] server/wrangler.toml 이 바뀌었습니다. [vars]·[[d1_databases]]·[assets]·nodejs_compat 이 server/src/env.ts 의 parseEnv 와 맞는지 보고, /dev-build(wrangler deploy --dry-run)로 번들을 다시 확인하세요. 비밀값은 [vars]에 넣지 않습니다." ;;
        *.sql)
            emit_context "[ld] D1 마이그레이션(${RESULT})이 추가·변경되었습니다. 로컬 D1에 'npx wrangler d1 migrations apply <DB> --local' 로 적용하고, doc/200_설계/server/db.md 스키마와 맞추세요. 운영 적용(--remote)은 /deploy 안에서만." ;;
        package.json)
            emit_context "[ld] package.json 이 바뀌었습니다(${RESULT}). 새 의존성이면 사용자 승인(설치 허가제)·doc/state.json dependencies_approved 기록을 확인하고, /dev-build 로 typecheck·build 를 다시 돌리세요." ;;
        *)
            emit_context "[ld] 빌드 설정이 바뀌었습니다(${RESULT}). /dev-build 로 typecheck·build(vite build + wrangler deploy --dry-run)를 다시 돌리고, server/wrangler.toml 과 어긋나지 않는지 확인하세요." ;;
    esac
fi

exit 0
