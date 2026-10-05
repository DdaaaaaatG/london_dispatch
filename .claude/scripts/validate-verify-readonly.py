#!/usr/bin/env python
"""verify 읽기 전용 가드: PreToolUse(Write|Edit, Bash) (Python).

목적: 배포 전 검증(verify-*) 에이전트는 **측정·판정만** 한다. 소스·설정을 바꾸지 않는다.
- Write|Edit: `doc/300_검증/`·`.claude/reports/` 경로의 `.md`/`.json`에만 허용(리포트 산출). 그 외 차단.
- Bash: 빌드·린트(--check)·테스트·조회 허용 —
    npx tsc --noEmit / npm run typecheck / npm run lint / npx eslint(--fix 없이) / npx prettier --check /
    npx vitest run / npm test / npm run test / npm run build /
    git log·diff·status·show, grep·rg·find·ls·cat·head·tail·wc, node/npm --version, curl -s http://localhost:…,
    wrangler 조회(whoami·--version·deployments list·d1 migrations list·deploy --dry-run)
  차단: eslint --fix, prettier --write(또는 --check 없는 prettier), rm/mv/cp/tee/리다이렉션, git 쓰기,
        npm run dev|start|deploy, wrangler deploy(실배포)·delete·d1 delete·secret·login/logout·`--remote`,
        설치(npm install <pkg>·npx <미허용>·pip/winget).

설계 원칙: fail-closed — 파싱 실패/판단 불가 시 막는다. 종료코드 2 = 차단(사유 stderr), 0 = 허용.
"""
import json
import os
import re
import sys


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


_DESTRUCTIVE = [
    r"\brm\b", r"\brmdir\b", r"\bmv\b", r"\bcp\b", r"\bdel\b", r"\berase\b", r"\btruncate\b", r"\btee\b",
    r"\bxargs\b", r"\bsed\b.*\s-i\b",
    r">{1,2}\s*[^&\s]",  # 파일 리다이렉션
    r"\bgit\s+(commit|push|pull|reset|checkout|switch|merge|rebase|stash|add|rm|restore|clean|branch\s+-[dDmM])\b",
    r"\bnpm\s+(run\s+(dev|start|deploy)|install\s+\S|i\s+\S|add|uninstall|update|publish|link)\b",
    r"\byarn\b", r"\bpnpm\b", r"\bbun\b",
    r"\bpip3?\s+install\b", r"\b(winget|choco|scoop)\s+install\b",
    r"\bwrangler\s+deploy\b(?![^&|;]*--dry-run\b)",
    r"\bwrangler\s+(delete|d1\s+delete|secret|login|logout|kv\b.*\bdelete)\b",
    r"\bwrangler\b[^&|;]*\s--remote\b",
    r"--write\b", r"--fix\b",
]
_DESTRUCTIVE_RE = [re.compile(p) for p in _DESTRUCTIVE]

_ALLOWED_PREFIX = [
    r"npx\s+tsc\b.*--noemit",
    r"npm\s+run\s+(typecheck|lint|test|build)\b",
    r"npm\s+(test|t)\b",
    r"npx\s+vitest\s+run\b",
    r"npx\s+eslint\b",
    r"npx\s+prettier\b.*--check",
    r"git\s+(log|diff|status|show|blame|ls-files|rev-parse|branch\s+--list|remote\s+-v)\b",
    r"(rg|grep|egrep|fgrep)\b",
    r"find\b(?![^|&;]*\s-(exec|execdir|delete|ok|okdir)\b)",
    r"(ls|dir|cat|head|tail|wc|stat|file|tree|pwd|echo|date|type|which|where)\b",
    r"(node|npm|python|py)\s+(--version|-V|-v)\b",
    r"npm\s+(ls|view|info)\b",
    r"curl\s+(-s\s+|--silent\s+)?(-i\s+|-o\s+\S+\s+|-w\s+\S+\s+|-x\s+\S+\s+)*[\"']?https?://(localhost|127\.0\.0\.1)[:/]",
    r"python\s+\S*scripts/docs/\S*\.py\b",
    r"(npx\s+)?wrangler\s+(whoami|--version|-v|deployments\s+list|d1\s+migrations\s+list)\b",
    r"(npx\s+)?wrangler\s+deploy\b(?=.*--dry-run)",
]
_ALLOWED_RE = [re.compile(p) for p in _ALLOWED_PREFIX]


def _check_bash(command: str) -> None:
    cmd = (command or "").strip()
    if not cmd:
        _block("verify: 빈 명령(fail-closed).")
    low = cmd.lower()
    for rx in _DESTRUCTIVE_RE:
        if rx.search(low):
            _block("verify는 읽기 전용입니다. 변경/파괴/배포 명령을 실행하지 않습니다(소스 수정·커밋·설치·포맷 쓰기·wrangler deploy/--remote 금지). "
                   "수정은 생산 에이전트(ui-debug/contract-manager/server-manager)로 라우팅하세요: " + cmd[:160])
    if re.search(r"\bprettier\b", low) and "--check" not in low:
        _block("verify는 파일을 수정하지 않습니다. prettier 는 --check 로만 실행하세요.")
    if re.search(r"\bvitest\b", low) and not re.search(r"\bvitest\s+run\b", low):
        _block("vitest 는 'vitest run' 으로만 실행합니다(watch 모드는 세션을 막는다).")
    segments = re.split(r"\s*(?:&&|\|\||;|\|)\s*", low)
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if seg.startswith("cd "):
            _block("verify의 Bash는 cd 를 쓰지 않습니다(프로젝트 루트 기준 상대 경로).")
        if not any(rx.match(seg) for rx in _ALLOWED_RE):
            _block("verify의 Bash는 빌드·린트(--check)·테스트·조회만 허용합니다. 허용 밖: " + seg[:120])
    sys.exit(0)


_ALLOWED_EXT_RE = re.compile(r"\.(md|json)$")


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
        _block("verify는 리포트 외 파일을 쓰지 않습니다(경로 미확인 → 차단).")
    if "/../" in norm or norm.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + norm)
    in_allowed = (norm.startswith("doc/300_검증/") or "/doc/300_검증/" in norm
                  or norm.startswith(".claude/reports/") or "/.claude/reports/" in norm)
    if in_allowed and _ALLOWED_EXT_RE.search(norm):
        sys.exit(0)
    _block("verify는 읽기 전용입니다. 리포트는 doc/300_검증/ 또는 .claude/reports/ 의 .md/.json 에만 쓰고, "
           "코드 수정은 생산 에이전트(ui-debug/contract-manager/server-manager)로 라우팅하세요.")


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
