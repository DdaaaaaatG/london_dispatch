#!/usr/bin/env python
"""분석가(server-analyst / contract-analyst / ui-error-analyst) 공용: PreToolUse(Write|Edit) 가드 (Python).

분석가는 읽기 전용이며, 파일 쓰기는 다음 두 곳에만 허용한다.
  - `.claude/reports/` 아래 리포트
  - 프로젝트 루트의 `.claude/agent-memory/{분석가 이름}/` 자체 메모리 (`memory: project`)
소스·설계 문서·설정 파일은 어떤 경로든 차단한다. `..` 이 들어간 경로는 차단한다.
`server/.claude/agent-memory/`처럼 하위 폴더에 생긴 메모리 폴더는 루트가 아니라 차단한다.

설계 원칙: fail-closed — 경로를 확인할 수 없으면 차단한다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import os
import re
import sys

ANALYST_MEMORY_DIRS = ("server-analyst", "contract-analyst", "ui-error-analyst")


def _extract_path(raw: str) -> str:
    try:
        data = json.loads(raw)
        ti = data.get("tool_input") or {}
        for key in ("file_path", "path", "filePath", "notebook_path"):
            val = ti.get(key)
            if isinstance(val, str) and val.strip():
                return val
    except Exception:
        pass
    m = re.search(r'"(?:file_path|path|filePath|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
    return m.group(1) if m else ""


def _block(message: str) -> None:
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.stderr.write("Blocked: " + message + "\n")
    sys.exit(2)


def _unify(p: str) -> str:
    p = p.replace("\\", "/")
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1)}:/{m.group(2)}"
    return p.lower()


def _relative_to_root(path: str) -> str:
    """프로젝트 루트 기준 상대 경로. 루트 밖 절대 경로면 빈 문자열."""
    if not re.match(r"^([a-z]:)?/", path):
        return path[2:] if path.startswith("./") else path
    root = _unify(os.environ.get("CLAUDE_PROJECT_DIR", "")).rstrip("/")
    if root and path.startswith(root + "/"):
        return path[len(root) + 1:]
    return ""


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    path = _unify(_extract_path(raw))
    if not path:
        _block("쓰기 대상 경로를 확인할 수 없어 차단합니다(분석가는 .claude/reports/ 아래에만 씁니다).")
    if "/../" in path or path.startswith("../") or path.endswith("/.."):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + path)
    if "/.claude/reports/" in path or path.startswith(".claude/reports/"):
        sys.exit(0)
    rel = _relative_to_root(path)
    for name in ANALYST_MEMORY_DIRS:
        if rel.startswith(".claude/agent-memory/" + name + "/"):
            sys.exit(0)
    _block(
        "분석가는 읽기 전용입니다. 리포트는 .claude/reports/, 메모리는 프로젝트 루트 "
        ".claude/agent-memory/{분석가}/ 아래에만 쓸 수 있습니다. 수정이 필요하면 해당 매니저"
        "(server-manager/contract-manager/ui-debug)에 인계 명세로 보고하세요: " + path
    )


if __name__ == "__main__":
    main()
