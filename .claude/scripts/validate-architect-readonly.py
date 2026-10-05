#!/usr/bin/env python
"""오케스트레이터 소스 쓰기 가드: PreToolUse(Write|Edit, Bash) (Python).

공유 스크립트다. 첫 번째 인자로 에이전트 라벨을 받는다(생략 시 `system-architect`).
    python validate-architect-readonly.py                # system-architect
    python validate-architect-readonly.py task-manager   # task-manager

목적: 두 오케스트레이터 모두 **소스·설정·계약 코드를 직접 바꾸지 않는다.**
- `system-architect`: 횡단 분석·전반설계만 하고 구현은 매니저(server/contract/ui-manager) 세션으로 인계한다.
- `task-manager`: 요구·RTM·상태 문서만 쓰고 구현은 리프 에이전트(server/contract/ui implementer)에 위임한다.

- Write|Edit: **설계/분석 산출물 경로에만** 허용 — `doc/` 아래 `.md`/`.json`, `.claude/reports/` 아래 `.md`/`.json`.
    소스(.ts/.tsx/.js/.css/.sql/.toml…), 설정(package.json/wrangler.toml/vite.config.ts/tsconfig*.json/.env*/.dev.vars*), 그 외 확장자는 차단.
- Bash: 조회/분석(git log·diff·status·show, grep·rg·find·ls·cat·head·tail·wc, npm --version, node --version,
    npx tsc --noEmit, python scripts/docs/*.py, wrangler 조회(whoami·deployments list·d1 migrations list·deploy --dry-run)) 허용.
    변경·파괴·설치·git 쓰기·npm run build/dev/start·wrangler deploy(실배포)/delete/secret/login/`--remote` 는 차단.

설계 원칙: fail-closed — 파싱 실패/판단 불가 시 막는다. 종료코드 2 = 차단(사유 stderr), 0 = 허용.
"""
import json
import os
import re
import sys

AGENT = sys.argv[1] if len(sys.argv) > 1 else "system-architect"
HANDOFF = (
    "구현은 리프 에이전트(server-implementer/contract-implementer/ui-implementer)에 위임하세요"
    if AGENT == "task-manager"
    else "구현은 매니저(server-manager/contract-manager/ui-manager) 세션으로 인계하세요"
)


def _load():
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    data_b = sys.stdin.buffer.read()
    try:
        raw = data_b.decode("utf-8")
    except UnicodeDecodeError:
        raw = data_b.decode("cp949", errors="replace")
    try:
        return json.loads(raw), raw
    except Exception:
        return None, raw


def _block(msg: str) -> None:
    sys.stderr.write("Blocked: " + msg + "\n")
    sys.exit(2)


# ── Bash: 허용 목록(조회 전용) ──────────────────────────────────────────────
_ALLOWED_PREFIX = [
    r"git\s+(log|diff|status|show|blame|ls-files|rev-parse|branch\s+--list|remote\s+-v|tag\s+-l)\b",
    r"(rg|grep|egrep|fgrep)\b",
    r"find\b(?![^|&;]*\s-(exec|execdir|delete|ok|okdir)\b)",
    r"(ls|dir|cat|head|tail|wc|stat|file|tree|pwd|echo|date|type|which|where)\b",
    r"(node|npm|python|py)\s+(--version|-V|-v)\b",
    r"npm\s+(ls|view|info)\b",
    r"npx\s+tsc\b.*--noemit",
    r"python\s+\S*scripts/docs/\S*\.py\b",
    r"(npx\s+)?wrangler\s+(whoami|--version|-v|deployments\s+list|d1\s+migrations\s+list)\b",
    r"(npx\s+)?wrangler\s+deploy\b(?=.*--dry-run)",
]
_ALLOWED_RE = [re.compile(p) for p in _ALLOWED_PREFIX]

# 어떤 경우에도 차단(허용 목록보다 우선)
_DESTRUCTIVE = [
    r"\brm\b", r"\brmdir\b", r"\bmv\b", r"\bcp\b", r"\bdel\b", r"\berase\b",
    r"\btouch\b", r"\btee\b", r"\btruncate\b", r"\bmkdir\b", r"\bxargs\b",
    r">{1,2}\s*[^&\s]",            # 리다이렉션(파일 쓰기)
    r"\bsed\b.*\s-i\b",
    r"\bgit\s+(commit|push|pull|reset|checkout|switch|merge|rebase|stash|add|rm|restore|clean|tag\s+[^-]|branch\s+-[dDmM])\b",
    r"\bnpm\s+(run\s+(build|dev|start|deploy)|install\s+\S|i\s+\S|add|uninstall|update|publish|link)\b",
    r"\byarn\b", r"\bpnpm\b", r"\bbun\b",
    r"\bnpx\s+(?!tsc\b|wrangler\b)",
    r"\bnode\s+(?!--version|-v\b)",
    r"\bpip3?\s+install\b", r"\b(winget|choco|scoop)\s+install\b",
    r"\bwrangler\s+deploy\b(?![^&|;]*--dry-run\b)",
    r"\bwrangler\s+(delete|d1\s+delete|secret|login|logout|kv\b.*\bdelete)\b",
    r"\bwrangler\b[^&|;]*\s--remote\b",
    r"--write\b", r"--fix\b",
]
_DESTRUCTIVE_RE = [re.compile(p) for p in _DESTRUCTIVE]


def _check_bash(command: str) -> None:
    cmd = (command or "").strip()
    if not cmd:
        _block(AGENT + ": 빈 명령(fail-closed).")
    low = cmd.lower()
    for rx in _DESTRUCTIVE_RE:
        if rx.search(low):
            _block(AGENT + "는 변경/파괴/실행 명령을 쓰지 않습니다(소스·설정 수정, 빌드·실행, 커밋, 설치, wrangler 배포·원격 금지). "
                   + HANDOFF + ": " + cmd[:160])
    segments = re.split(r"\s*(?:&&|\|\||;|\|)\s*", low)
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if seg.startswith("cd "):
            _block(AGENT + "의 Bash는 cd 를 쓰지 않습니다(프로젝트 루트 기준 상대 경로).")
        if not any(rx.match(seg) for rx in _ALLOWED_RE):
            _block(AGENT + "의 Bash는 조회·분석 명령만 허용합니다(git log/diff/status, grep, rg, find, ls, cat, "
                   "head, tail, wc, npm ls, npx tsc --noEmit, wrangler whoami/deployments list/d1 migrations list/deploy --dry-run). 허용 밖: " + seg[:120])
    sys.exit(0)


# ── Write/Edit: 산출물 경로만 ───────────────────────────────────────────────
_ALLOWED_WRITE = ("doc/", ".claude/reports/")
_ALLOWED_EXT_RE = re.compile(r"\.(md|json)$")
_SOURCE_EXT_RE = re.compile(r"\.(ts|tsx|js|jsx|mjs|cjs|css|html|toml|yaml|yml|sh|ps1|py|sql)$")
_CONFIG_BASE_RE = re.compile(r"^(package\.json|package-lock\.json|wrangler\.toml|vite\.config\.ts|tsconfig[^/]*\.json|\.env[^/]*|\.dev\.vars[^/]*)$")


def _normalize(path: str) -> str:
    p = path.replace("\\", "/")
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1)}:/{m.group(2)}"
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").replace("\\", "/").rstrip("/")
    if root and p.lower().startswith(root.lower() + "/"):
        p = p[len(root) + 1:]
    p = re.sub(r"^\./", "", p)
    return p.lower()


def _check_write(tool_input: dict) -> None:
    path = ""
    for key in ("file_path", "path", "filePath", "notebook_path"):
        v = tool_input.get(key)
        if isinstance(v, str) and v.strip():
            path = v
            break
    norm = _normalize(path)
    if not norm:
        _block(AGENT + "는 산출물 외 파일을 쓰지 않습니다(경로 미확인 → 차단).")
    if "/../" in norm or norm.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + norm)
    base = norm.rsplit("/", 1)[-1]
    if _CONFIG_BASE_RE.match(base):
        _block(AGENT + "는 설정 파일을 직접 쓰지 않습니다. " + HANDOFF + ".")
    if _SOURCE_EXT_RE.search(norm):
        _block(AGENT + "는 소스 파일을 직접 쓰지 않습니다. " + HANDOFF + ".")
    if not (norm.startswith("doc/") or "/doc/" in norm or norm.startswith(".claude/reports/") or "/.claude/reports/" in norm):
        _block(AGENT + "의 산출물은 doc/(요구·설계·상태 문서)·.claude/reports/(리포트)에만 씁니다. " + HANDOFF + ".")
    if not _ALLOWED_EXT_RE.search(norm):
        _block(AGENT + "의 산출물은 .md/.json 문서만 허용합니다: " + norm)
    sys.exit(0)


def main() -> None:
    data, _raw = _load()
    if data is None:
        _block("입력 파싱 실패(fail-closed).")
    tool = data.get("tool_name") or data.get("toolName") or ""
    ti = data.get("tool_input") or {}
    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        _check_write(ti if isinstance(ti, dict) else {})
    elif tool == "Bash":
        _check_bash(ti.get("command", "") if isinstance(ti, dict) else "")
    sys.exit(0)


if __name__ == "__main__":
    main()
