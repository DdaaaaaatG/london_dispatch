#!/usr/bin/env python
"""비밀값 격리 가드: PreToolUse(Write|Edit) (Python).

호출자: server-implementer, contract-implementer, ui-implementer, ui-fixer (전역 훅 ld-secret-scope-guard.sh 와 이중 장치)
목적: `process.env` / `import.meta.env` 읽기는 `server/src/env.ts`(서버)·`ui/src/config.ts`(화면)에서만 허용한다
      (확정사항 §3·§8 비밀값 격리). 다른 모듈은 검증된 env 객체를 import 한다.
      `.env` 실파일(.env, .env.local …) 쓰기는 항상 차단한다. `.env.example` 만 허용.

판정
----
- 쓰기 내용(`new_string` / `content` / `new_source` / MultiEdit `edits[].new_string`)에서 주석(`//`, `#`)을 뗀 뒤
  `process.env` 또는 `import.meta.env` 가 있고, 대상 경로가 허용 2곳이 아니면 → 차단.
- 문서 확장자(.md/.markdown/.txt/.html/.json/.example)는 검사하지 않는다.
- JSON 파싱 실패 + 원본에 `process.env` → 보수적으로 차단.

설계 원칙: fail-closed — 경로를 못 읽으면 차단.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import re
import sys

_ENV_RE = re.compile(r"\bprocess\.env\b|\bimport\.meta\.env\b")
_DOC_EXT = (".md", ".markdown", ".txt", ".html", ".json", ".example")
_ALLOWED_RE = re.compile(r"(^|/)(server/src/env\.ts|ui/src/config\.ts)$")


def _block(message: str) -> None:
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.stderr.write("Blocked: " + message + "\n")
    sys.exit(2)


def _strip_comments(text: str) -> str:
    out = []
    for line in text.splitlines():
        line = line.split("//", 1)[0]
        line = line.split("#", 1)[0]
        out.append(line)
    return "\n".join(out)


def _bodies(ti: dict) -> list:
    bodies = []
    edits = ti.get("edits")
    if isinstance(edits, list):
        bodies += [e.get("new_string") or "" for e in edits if isinstance(e, dict)]
    b = ti.get("new_string")
    if b is None:
        b = ti.get("content") or ti.get("new_source") or ""
    bodies.append(b if isinstance(b, str) else "")
    return bodies


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    try:
        data = json.loads(raw)
    except Exception:
        if _ENV_RE.search(raw):
            _block("입력을 해석할 수 없고 process.env 가 포함되어 차단합니다.")
        sys.exit(0)

    if data.get("tool_name", "") not in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        sys.exit(0)

    ti = data.get("tool_input") or {}
    path = ""
    for key in ("file_path", "path", "filePath", "notebook_path"):
        val = ti.get(key)
        if isinstance(val, str) and val.strip():
            path = val
            break
    norm = path.replace("\\", "/").lower()
    base = norm.rsplit("/", 1)[-1]

    if base == ".env" or (re.match(r"^\.env\.[^/]+$", base) and base != ".env.example"):
        _block(".env 실파일은 쓰지 않습니다(비밀값은 사용자가 직접 넣는다). 키 이름·설명만 .env.example 에 적으세요: " + path)

    if norm.endswith(_DOC_EXT):
        sys.exit(0)
    if not any(_ENV_RE.search(_strip_comments(b)) for b in _bodies(ti)):
        sys.exit(0)
    if not norm:
        _block("process.env 가 포함된 쓰기인데 경로를 확인할 수 없어 차단합니다.")
    if _ALLOWED_RE.search(norm):
        sys.exit(0)
    _block("비밀값·환경변수는 server/src/env.ts(서버) / ui/src/config.ts(화면)에서만 읽습니다 — env 객체를 import 하세요: " + path)


if __name__ == "__main__":
    main()
