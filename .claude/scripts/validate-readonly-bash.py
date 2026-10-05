#!/usr/bin/env python
"""읽기 전용 Bash 가드: PreToolUse(Bash) (Python).

호출자: manager 3종(server/contract/ui), checker 3종, analyst 2종, ui-error-analyst, system-architect,
        designer 2종(server-designer/contract-designer).
목적: 이들은 **조회·분석만** 한다. 파일을 쓰거나 git·npm으로 상태를 바꾸는 명령은 역할 위반이므로 차단한다.

허용
----
- 조회: git status/log/diff/show/branch(--list·조회)/rev-parse/ls-files/blame/remote(-v·show·get-url),
        ls, dir, cat, type, head, tail, wc, find(-exec/-delete/-ok 없이), grep, rg, echo, date, pwd, which, where
- 분석 스크립트: `python scripts/docs/<파일>.py ...`
- 테스트·타입 확인(관찰용, 소스 불변): npm test, npm run test|typecheck|lint, npx vitest run, npx tsc --noEmit,
        npx prettier --check, npx eslint(--fix 없이), npm --version, npm ls, npm view, node --version
- 파이프 뒤: grep/rg/head/tail/wc/sort/uniq/cut/tr/cat 만

차단
----
- 리다이렉션(`>`, `>>`), sed -i, xargs, 쓰기 명령(rm/mv/cp/touch/mkdir/del/rmdir/tee), node -e
- find -exec / -delete / -ok, git branch -D/-d/-m, git remote add/remove/set-url
- git commit/push/reset/checkout/add/stash/rebase/merge/clean
- npm run dev|start|build|deploy, npm install <pkg>, npx <허용 외>, railway 전부
- cd(경로 이동으로 가드 경로가 어긋난다 — 상대 경로로 지정)

설계 원칙: fail-closed — 파싱 실패·판단 불가는 차단.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import re
import shlex
import sys


def _extract_command(raw: str) -> str:
    try:
        data = json.loads(raw)
        cmd = (data.get("tool_input") or {}).get("command")
        if isinstance(cmd, str) and cmd.strip():
            return cmd
    except Exception:
        pass
    return raw


def _block(message: str) -> None:
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.stderr.write("Blocked: " + message + "\n")
    sys.exit(2)


_ALLOWED_HEAD = {
    "ls", "dir", "cat", "type", "head", "tail", "wc", "grep", "rg",
    "echo", "date", "pwd", "printf", "test", "true", "which", "where", "stat", "file", "tree",
}
_ALLOWED_FILTER = {"grep", "rg", "head", "tail", "wc", "sort", "uniq", "cut", "tr", "cat"}
_GIT_READ = {"status", "log", "diff", "show", "rev-parse", "ls-files", "blame"}
_GIT_BRANCH_BAD = {"-d", "-D", "-m", "-M", "--delete", "--move", "-c", "-C", "--copy"}
_GIT_REMOTE_OK = {"-v", "--verbose", "show", "get-url"}
_FIND_BAD = {"-exec", "-execdir", "-delete", "-ok", "-okdir"}
_NPM_RUN_OK = {"test", "typecheck", "lint"}
_NPM_TOP_OK = {"test", "t", "--version", "-v", "ls", "view", "info"}

_REDIRECT = re.compile(r"(?<![<>])>{1,2}(?![<>])")
_SED_INPLACE = re.compile(r"\bsed\b.*\s-i\b")
_PY_DOCS = re.compile(r"^(python|python3|py)$")


def _check_npx(toks: list) -> None:
    sub = toks[1].lower() if len(toks) > 1 else ""
    rest = [t.lower() for t in toks[2:]]
    if sub == "vitest" and "run" in rest and "--watch" not in rest:
        return
    if sub == "tsc" and "--noemit" in rest:
        return
    if sub == "prettier" and "--check" in rest and "--write" not in rest:
        return
    if sub == "eslint" and "--fix" not in rest:
        return
    _block(f"읽기 전용 역할의 npx는 vitest run / tsc --noEmit / prettier --check / eslint(--fix 없이)만 허용됩니다: npx {sub}")


def _check_npm(toks: list) -> None:
    sub = toks[1].lower() if len(toks) > 1 else ""
    if sub in _NPM_TOP_OK:
        return
    if sub == "run":
        script = toks[2].lower() if len(toks) > 2 else ""
        if script in _NPM_RUN_OK:
            return
        _block(f"읽기 전용 역할에서는 npm run {script}을(를) 실행할 수 없습니다(test/typecheck/lint만 허용).")
    _block(f"읽기 전용 역할에서는 npm {sub}을(를) 실행할 수 없습니다(test/run test|typecheck|lint/--version/ls/view만 허용).")


def _check_segment(seg: str, after_pipe: bool) -> None:
    seg = seg.strip()
    if not seg:
        return
    try:
        toks = shlex.split(seg, posix=True)
    except ValueError:
        _block("명령을 해석할 수 없어 차단합니다(따옴표 불일치 등).")
    if not toks:
        return
    head = toks[0].lower()
    if after_pipe:
        if head in _ALLOWED_FILTER:
            return
        _block(f"파이프 뒤에는 필터 명령({', '.join(sorted(_ALLOWED_FILTER))})만 허용됩니다: {head}")
    if head in _ALLOWED_HEAD:
        return
    if head == "find":
        if any(t in _FIND_BAD for t in toks[1:]):
            _block("find -exec/-delete/-ok 는 파일을 바꾸므로 차단합니다.")
        return
    if head == "git":
        sub = toks[1].lower() if len(toks) > 1 else ""
        if sub in _GIT_READ:
            return
        if sub == "branch":
            if any(t in _GIT_BRANCH_BAD for t in toks[2:]):
                _block("git branch 삭제/이름변경(-D/-d/-m)은 차단합니다(조회만 허용).")
            return
        if sub == "remote":
            if len(toks) == 2 or toks[2] in _GIT_REMOTE_OK:
                return
            _block("git remote 는 -v/show/get-url 조회만 허용됩니다.")
        _block(f"읽기 전용 역할에서는 git {sub}을(를) 실행할 수 없습니다(조회만 허용).")
    if head == "npm":
        _check_npm(toks)
        return
    if head == "npx":
        _check_npx(toks)
        return
    if head == "node":
        if len(toks) > 1 and toks[1] in ("--version", "-v"):
            return
        _block("읽기 전용 역할에서는 node 실행(node -e, 스크립트)을 할 수 없습니다(--version만 허용).")
    if _PY_DOCS.match(head):
        script = toks[1].replace("\\", "/") if len(toks) > 1 else ""
        if "scripts/docs/" in script and script.endswith(".py"):
            return
        _block("python 실행은 scripts/docs/ 아래 분석 스크립트만 허용됩니다.")
    if head == "railway":
        _block("railway CLI 는 읽기 전용 역할에서 실행하지 않습니다(배포·조회 모두 메인 세션).")
    if head == "cd":
        _block("cd 는 가드 경로를 어긋나게 합니다. 프로젝트 루트 기준 상대 경로로 지정하세요.")
    if head == "xargs":
        _block("xargs 는 임의 명령 실행이라 차단합니다.")
    _block(f"읽기 전용 역할에서 허용되지 않는 명령입니다: {head}")


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    command = _extract_command(raw)
    if not command.strip():
        _block("빈 명령(fail-closed).")

    if _REDIRECT.search(command):
        _block("리다이렉션(>, >>)은 파일을 쓰므로 차단합니다.")
    if _SED_INPLACE.search(command):
        _block("sed -i 는 파일을 고치므로 차단합니다.")

    for chain in re.split(r"&&|\|\||;", command):
        parts = chain.split("|")
        for i, part in enumerate(parts):
            _check_segment(part, after_pipe=(i > 0))

    sys.exit(0)


if __name__ == "__main__":
    main()
