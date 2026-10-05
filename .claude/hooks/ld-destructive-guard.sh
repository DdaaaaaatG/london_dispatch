#!/bin/bash
# ld-destructive-guard.sh - PreToolUse Hook (Bash)
# 되돌릴 수 없는 파괴적 명령을 실행 전에 차단한다.
#   차단: rm -rf(node_modules/dist/coverage/.vite 제외 — server/.wrangler/ 는 로컬 D1 상태라 허용 목록에 넣지 않는다),
#         git reset --hard, git push --force, git clean -fd, git checkout -- . / git restore .,
#         server/.wrangler/(로컬 D1 상태)·*.sqlite* 삭제,
#         wrangler delete / wrangler d1 delete / wrangler secret delete / wrangler kv … delete /
#         wrangler d1 execute … --remote … (DROP|DELETE|TRUNCATE)
#   경고(비차단, 메인 세션 /deploy 전용): wrangler deploy(--dry-run 제외), wrangler d1 migrations apply … --remote
# python을 찾지 못하면 fail-closed(exit 2) — 검사 없이 통과시키지 않는다.
# Exit codes: 0 = allow, 2 = block
# 한글 메시지는 bash echo로 낸다 — python stderr는 이 환경에서 cp949라 깨진다.

INPUT=$(cat)

. "$(dirname "$0")/_common.sh"
PY=$(resolve_python) || {
    echo "BLOCKED: $(basename "$0"): python을 찾지 못해 파괴 명령 검사를 할 수 없습니다(fail-closed). python을 PATH에 두세요." >&2
    exit 2
}

VERDICT=$(echo "$INPUT" | "$PY" -c "
import sys, json, re

try:
    d = json.load(sys.stdin)
except Exception:
    print('PARSE'); sys.exit(0)

if d.get('tool_name', '') != 'Bash':
    sys.exit(0)

cmd = (d.get('tool_input') or {}).get('command') or ''
if not cmd.strip():
    sys.exit(0)

low = cmd.lower().replace('\\\\', '/')

# 1) git 파괴 명령
if re.search(r'\bgit\s+reset\s+.*--hard', low):
    print('GIT_RESET'); sys.exit(0)
if re.search(r'\bgit\s+push\b.*(\s--force\b|\s-f\b|--force-with-lease)', low):
    print('GIT_FORCE'); sys.exit(0)
if re.search(r'\bgit\s+clean\b.*-[a-z]*[fd]', low):
    print('GIT_CLEAN'); sys.exit(0)
if re.search(r'\bgit\s+checkout\s+--\s+\.', low) or re.search(r'\bgit\s+restore\s+\.\s*$', low):
    print('GIT_CHECKOUT'); sys.exit(0)

# 2) 로컬 D1 상태(server/.wrangler/) 또는 SQLite 파일 삭제 — rm/del/Remove-Item 어떤 형태든
if re.search(r'\b(rm|del|erase|rmdir|rd|remove-item)\b[^&|;]*((^|[\s\"\'/=])\.wrangler(/|\b)|\.sqlite)', low):
    print('DATA'); sys.exit(0)

# 3) rm -rf — 빌드 산출물(node_modules/dist/coverage/.vite) 대상만 허용
m = re.search(r'\brm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+(.+)', low)
if m:
    targets = [t for t in re.split(r'\s+', m.group(2).strip()) if t and not t.startswith('-')]
    if not targets:
        print('RM_RF'); sys.exit(0)
    allowed = re.compile(r'(^|/)(node_modules|dist|coverage|\.vite)(/|$)')
    for t in targets:
        t = t.strip('\"\\'')
        if t in ('/', '.', '..', '*', '~', './', '../') or not allowed.search(t):
            print('RM_RF'); sys.exit(0)

# 4) Cloudflare(wrangler) 파괴·배포 명령
if re.search(r'\bwrangler\s+delete\b', low):
    print('WRANGLER_DELETE'); sys.exit(0)
if re.search(r'\bwrangler\s+d1\s+delete\b', low):
    print('D1_DELETE'); sys.exit(0)
if re.search(r'\bwrangler\s+secret\s+delete\b', low):
    print('SECRET_DELETE'); sys.exit(0)
if re.search(r'\bwrangler\s+kv\b[^&|;]*\bdelete\b', low):
    print('KV_DELETE'); sys.exit(0)
for seg in re.findall(r'\bwrangler\s+d1\s+execute\b([^&|;]*)', low):
    if '--remote' in seg and re.search(r'\b(drop|delete|truncate)\b', seg):
        print('D1_REMOTE_DESTRUCTIVE'); sys.exit(0)
if re.search(r'\bwrangler\s+deploy\b(?![^&|;]*--dry-run\b)', low):
    print('WRANGLER_DEPLOY'); sys.exit(0)
if re.search(r'\bwrangler\s+d1\s+migrations\s+apply\b[^&|;]*--remote\b', low):
    print('D1_MIGRATE_REMOTE'); sys.exit(0)

sys.exit(0)
" 2>/dev/null)

case "$VERDICT" in
    PARSE)
        echo "BLOCKED: 훅 입력(JSON)을 해석할 수 없어 차단합니다(fail-closed)." >&2
        exit 2 ;;
    GIT_RESET)
        echo "BLOCKED: git reset --hard는 작업 트리 변경을 모두 버립니다. git stash 또는 개별 파일 복원을 쓰세요." >&2
        exit 2 ;;
    GIT_FORCE)
        echo "BLOCKED: git push --force는 원격 이력을 덮어씁니다. 1인 개발이라도 금지입니다(settings.json deny)." >&2
        exit 2 ;;
    GIT_CLEAN)
        echo "BLOCKED: git clean -f/-d는 추적되지 않은 파일을 삭제합니다. 대상을 확인하고 개별 삭제하세요." >&2
        exit 2 ;;
    GIT_CHECKOUT)
        echo "BLOCKED: 작업 트리 전체 되돌리기(git checkout -- . / git restore .)는 금지입니다. 파일 단위로 지정하세요." >&2
        exit 2 ;;
    DATA)
        echo "BLOCKED: server/.wrangler/(로컬 D1 상태) 또는 SQLite 파일 삭제가 감지되었습니다. 로컬 방·대화 기록이 사라집니다. 사용자 확인을 받으세요." >&2
        exit 2 ;;
    RM_RF)
        echo "BLOCKED: rm -rf는 node_modules/dist/coverage/.vite 하위에만 허용됩니다(.wrangler 는 로컬 D1 데이터라 제외). 그 외는 대상을 확인해 개별 삭제하세요." >&2
        exit 2 ;;
    WRANGLER_DELETE)
        echo "BLOCKED: wrangler delete는 운영 Worker를 지웁니다. 사용자가 Cloudflare 대시보드에서 직접 수행합니다." >&2
        exit 2 ;;
    D1_DELETE)
        echo "BLOCKED: wrangler d1 delete는 운영 DB(방·대화·장기기억)를 지웁니다. 사용자가 직접 수행합니다." >&2
        exit 2 ;;
    SECRET_DELETE)
        echo "BLOCKED: wrangler secret delete는 운영 비밀값(TOKEN_SECRET·LLM 키)을 지웁니다. 사용자가 직접 수행합니다." >&2
        exit 2 ;;
    KV_DELETE)
        echo "BLOCKED: wrangler kv … delete는 운영 저장소를 지웁니다. 사용자가 직접 수행합니다." >&2
        exit 2 ;;
    D1_REMOTE_DESTRUCTIVE)
        echo "BLOCKED: 운영 D1(--remote)에 DROP/DELETE/TRUNCATE를 실행하려 합니다. 스키마 변경은 server/migrations/*.sql + /deploy 로, 데이터 삭제는 사용자가 직접 수행합니다." >&2
        exit 2 ;;
    WRANGLER_DEPLOY)
        echo "[ld] wrangler deploy는 운영 배포입니다. /deploy 절차(verify PASS + 사용자 확인) 안에서만 실행하세요. 번들 확인은 --dry-run." >&2
        exit 0 ;;
    D1_MIGRATE_REMOTE)
        echo "[ld] wrangler d1 migrations apply --remote는 운영 DB 스키마를 바꿉니다. /deploy 절차(사용자 확인) 안에서만 실행하세요." >&2
        exit 0 ;;
esac

exit 0
