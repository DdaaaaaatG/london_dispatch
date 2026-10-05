#!/bin/bash
# ld-secret-scope-guard.sh - PreToolUse Hook (Edit|Write)
# 비밀값·환경변수 읽기는 한 곳에서만 (확정사항 §3 비밀값 격리).
#   - 쓰려는 내용에 `process.env` 또는 `import.meta.env` 가 있고(주석 제외)
#   - 파일이 문서(.md/.txt/.html/.json/.example)가 아니며
#   - 경로가 server/src/env.ts(서버) / ui/src/config.ts(화면) 가 아니면 차단
#   - 비밀값 실파일 쓰기는 항상 차단: Workers 로컬 비밀값 `.dev.vars`·`.dev.vars.*`, 그리고 이 프로젝트가 쓰지 않는 `.env*` 전부.
#     예제 파일 `.dev.vars.example`(키 이름만, 실값 없음)만 허용. 운영 비밀값은 Cloudflare Secrets(wrangler secret put).
# MultiEdit 의 edits[].new_string 도 검사한다.
# 에이전트별 스크립트 가드(validate-secret-scope.py)와 함께 이중 안전 장치다.
# python을 찾지 못하면 fail-closed(exit 2).
# Exit codes: 0 = allow, 2 = block

INPUT=$(cat)

. "$(dirname "$0")/_common.sh"
PY=$(resolve_python) || {
    echo "BLOCKED: $(basename "$0"): python을 찾지 못해 비밀값 검사를 할 수 없습니다(fail-closed). python을 PATH에 두세요." >&2
    exit 2
}

VERDICT=$(echo "$INPUT" | "$PY" -c "
import sys, json, re

try:
    d = json.load(sys.stdin)
except Exception:
    print('PARSE'); sys.exit(0)

if d.get('tool_name', '') not in ('Edit', 'Write', 'MultiEdit', 'NotebookEdit'):
    sys.exit(0)

inp = d.get('tool_input') or {}
fp = (inp.get('file_path') or inp.get('notebook_path') or inp.get('path') or '').replace('\\\\', '/')
if not fp:
    print('NOPATH'); sys.exit(0)

low = fp.lower()
base = low.rsplit('/', 1)[-1]

# .dev.vars 실파일 쓰기 금지 (.dev.vars.example 제외). .env* 는 이 프로젝트가 쓰지 않으므로 전부 금지.
if base == '.env' or re.match(r'^\.env\.[^/]+$', base):
    print('ENVFILE|' + fp); sys.exit(0)
if base == '.dev.vars' or (re.match(r'^\.dev\.vars\.[^/]+$', base) and base != '.dev.vars.example'):
    print('DEVVARS|' + fp); sys.exit(0)

if low.endswith(('.md', '.markdown', '.txt', '.html', '.json', '.example')):
    sys.exit(0)

bodies = []
if isinstance(inp.get('edits'), list):
    bodies += [e.get('new_string') or '' for e in inp['edits'] if isinstance(e, dict)]
b = inp.get('new_string')
if b is None:
    b = inp.get('content') or inp.get('new_source') or ''
bodies.append(b or '')

ENV_RE = re.compile(r'\bprocess\.env\b|\bimport\.meta\.env\b')
def strip_comments(text):
    out = []
    for line in text.splitlines():
        line = line.split('//', 1)[0]
        line = line.split('#', 1)[0]
        out.append(line)
    return '\n'.join(out)

if not any(ENV_RE.search(strip_comments(x)) for x in bodies):
    sys.exit(0)

if re.search(r'(^|/)server/src/env\.ts$', low) or re.search(r'(^|/)ui/src/config\.ts$', low):
    sys.exit(0)

print('ENV|' + fp)
" 2>/dev/null)

case "$VERDICT" in
    PARSE)
        echo "BLOCKED: 훅 입력(JSON)을 해석할 수 없어 차단합니다(fail-closed)." >&2
        exit 2 ;;
    NOPATH)
        echo "BLOCKED: 쓰기 대상 경로를 확인할 수 없어 차단합니다(fail-closed)." >&2
        exit 2 ;;
    ENVFILE\|*)
        echo "BLOCKED: 이 프로젝트는 .env 파일을 쓰지 않습니다(로컬 비밀값은 server/.dev.vars 에 사용자가 직접, 운영은 Cloudflare Secrets). 키 이름·설명은 server/.dev.vars.example 에 적으세요. 대상: ${VERDICT#ENVFILE|}" >&2
        exit 2 ;;
    DEVVARS\|*)
        echo "BLOCKED: .dev.vars 실파일은 쓰지 않습니다(로컬 비밀값은 사용자가 직접 넣고, 운영은 wrangler secret put). 키 이름·설명만 server/.dev.vars.example 에 적으세요. 대상: ${VERDICT#DEVVARS|}" >&2
        exit 2 ;;
    ENV\|*)
        echo "BLOCKED: 비밀값·환경변수는 server/src/env.ts(서버) / ui/src/config.ts(화면)에서만 읽습니다 — env 객체를 import 하세요. 대상: ${VERDICT#ENV|}" >&2
        exit 2 ;;
esac

exit 0
