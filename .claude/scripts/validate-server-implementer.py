#!/usr/bin/env python
"""server-implementer / contract-implementer 전용: PreToolUse(Bash) 가드 (Python).

목적: Workers(Hono)/TS 구현에 필요한 테스트·타입검사·빌드·로컬 실행은 허용하되, 파괴적 명령·원격(Cloudflare) 반영·배포·
      의존성 설치를 도구 차원에서 차단한다.

허용
----
- npm test, npm run <test|typecheck|lint|build|dev>, npx vitest run, npx tsc --noEmit, node <스크립트>,
  npx wrangler dev / wrangler d1 migrations apply <DB> --local / wrangler d1 execute <DB> --local … /
  wrangler deploy --dry-run / wrangler types,
  curl http://localhost:…, 조회 명령 전부(git status/log/diff, ls, cat, grep …)

차단(denylist — 허용 목록보다 우선)
----
- 파괴: rm -rf, del /s, rmdir /s, Remove-Item -Recurse, server/.wrangler/(로컬 D1 상태)·*.sqlite 삭제
- git: push(전부), reset --hard, checkout -- <경로>, clean, rebase
- 배포·원격: wrangler deploy(--dry-run 제외), wrangler delete, wrangler d1 delete, wrangler secret *,
  wrangler login/logout, `--remote` 가 붙은 wrangler 명령 전부, npm run deploy
- 설치: npm install <패키지>, npm -g, yarn/pnpm/bun add, npx <미허용>, pip install, winget, choco, scoop

설계 원칙: fail-closed — 파싱 실패 시 원본 전체를 검사하고, 의심되면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import re
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


_RULES = [
    (re.compile(r"\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b", re.I),
     "rm -rf 는 차단됩니다. 삭제가 필요하면 대상을 보고하고 사용자가 메인 세션에서 수행합니다."),
    (re.compile(r"\b(del|erase)\b[^&|;]*\s/s\b", re.I), "del /s 는 차단됩니다."),
    (re.compile(r"\brmdir\b[^&|;]*\s/s\b", re.I), "rmdir /s 는 차단됩니다."),
    (re.compile(r"\bRemove-Item\b[^&|;]*-Recurse\b", re.I), "Remove-Item -Recurse 는 차단됩니다."),
    (re.compile(r"\b(rm|del|erase|rmdir|rd|Remove-Item)\b[^&|;]*((^|[\s\"'/=])\.wrangler(/|\b)|\.sqlite)", re.I),
     "server/.wrangler/(로컬 D1 상태) 또는 SQLite 파일 삭제는 로컬 방·대화 기록을 지웁니다. 차단합니다."),
    (re.compile(r"\bgit\s+push\b", re.I), "git push 는 /sync 명령으로 사용자가 수행합니다."),
    (re.compile(r"\bgit\s+reset\b[^&|;]*--hard\b", re.I), "git reset --hard 는 작업 내용을 잃습니다. 차단합니다."),
    (re.compile(r"\bgit\s+checkout\s+--\s", re.I), "git checkout -- <경로> 는 수정 내용을 되돌립니다. 차단합니다."),
    (re.compile(r"\bgit\s+(clean|rebase)\b", re.I), "git clean/rebase 는 차단됩니다."),
    (re.compile(r"\bwrangler\s+deploy\b(?![^&|;]*--dry-run\b)", re.I),
     "wrangler deploy(실배포)는 메인 세션의 /deploy(사용자 확인) 전용입니다. 번들 확인은 wrangler deploy --dry-run --outdir dist 를 쓰세요."),
    (re.compile(r"\bwrangler\s+(delete|d1\s+delete|secret|login|logout)\b", re.I),
     "wrangler delete / d1 delete / secret / login·logout 은 Cloudflare 운영 상태를 바꿉니다. 메인 세션(사용자 확인) 전용입니다."),
    (re.compile(r"\bwrangler\b[^&|;]*\s--remote\b", re.I),
     "--remote 가 붙은 wrangler 명령은 운영 D1·Workers 를 건드립니다. 로컬은 --local 을 쓰고, 운영 적용은 /deploy 전용입니다."),
    (re.compile(r"\bwrangler\s+d1\s+(execute|migrations\s+apply)\b(?![^&|;]*\s--local\b)", re.I),
     "wrangler d1 execute / migrations apply 는 --local 을 명시해야 합니다(fail-closed: 대상 DB 불명 → 차단)."),
    (re.compile(r"\bnpm\s+run\s+deploy\b", re.I), "npm run deploy 는 메인 세션 /deploy 전용입니다."),
    (re.compile(r"\b(yarn|pnpm|bun)\s+(global\s+)?add\b", re.I), "yarn/pnpm/bun add 는 사용자 승인 후 메인 세션에서 합니다."),
    (re.compile(r"\bnpm\s+(i|install)\b[^&|;]*(\s-g\b|\s--global\b)", re.I), "npm 전역 설치는 차단됩니다."),
    (re.compile(r"\b(pip|pip3)\s+install\b|\bwinget\s+install\b|\bchoco\s+install\b|\bscoop\s+install\b", re.I),
     "시스템 패키지 설치는 차단됩니다."),
]
_NPM_INSTALL = re.compile(r"\b(npm|pnpm|bun)\s+(install|i|add)\b(?P<rest>[^&|;]*)", re.I)
_NPX = re.compile(r"\bnpx\s+(?:--yes\s+|-y\s+)?(?P<pkg>\S+)", re.I)
_NPX_ALLOWED = {"vitest", "tsc", "eslint", "prettier", "vite", "wrangler"}


def _has_package_arg(rest: str) -> bool:
    return any(tok and not tok.startswith("-") for tok in rest.strip().split())


def _npx_pkg_name(pkg: str) -> str:
    p = pkg.lower()
    if p.startswith("@"):
        parts = p.split("@")
        return "@" + parts[1] if len(parts) > 1 else p
    return p.split("@", 1)[0]


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    command = _extract_command(raw)
    if not command.strip():
        _block("빈 명령(fail-closed).")

    for pattern, message in _RULES:
        if pattern.search(command):
            _block(message)
    for m in _NPM_INSTALL.finditer(command):
        if _has_package_arg(m.group("rest")):
            _block("npm/pnpm install <패키지> 는 사용자 승인 후 메인 세션에서 합니다.")
    for m in _NPX.finditer(command):
        if _npx_pkg_name(m.group("pkg")) not in _NPX_ALLOWED:
            _block(f"npx {m.group('pkg')} 는 설치를 동반할 수 있어 차단합니다(허용: {', '.join(sorted(_NPX_ALLOWED))}).")

    sys.exit(0)


if __name__ == "__main__":
    main()
