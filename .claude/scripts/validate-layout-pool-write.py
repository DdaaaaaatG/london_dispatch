#!/usr/bin/env python
"""ui-layout-designer 전용: PreToolUse(Write|Edit) 가드 (Python).

목적: 레이아웃 설계자는 파일을 만들지 않는다 — 유일한 예외가 **레이아웃 풀 저장**이다.
허용: 레이아웃 풀 경로(`.claude/skills/layout-pool/`) 하위 쓰기만.
그 외(소스 .tsx, 설계문서 design.md 등) 쓰기는 차단한다(구성안은 텍스트로 반환).

설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import sys

try:
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def _file_path(raw: str) -> str:
    try:
        data = json.loads(raw)
        ti = data.get("tool_input") or {}
        for key in ("file_path", "path", "filePath", "notebook_path"):
            v = ti.get(key)
            if isinstance(v, str) and v.strip():
                return v
    except Exception:
        return ""
    return ""


def _block(message: str) -> None:
    sys.stderr.write("Blocked: " + message + "\n")
    sys.exit(2)


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    path = _file_path(raw).replace("\\", "/").lower()

    if not path:
        _block("ui-layout-designer: 쓰기 대상 경로를 확인할 수 없어 차단합니다. "
               "레이아웃 풀(.claude/skills/layout-pool/) 외에는 파일을 만들지 않습니다.")
    if "/../" in path or path.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + path)

    if ".claude/skills/layout-pool/" not in path:
        _block("ui-layout-designer는 구성안을 텍스트로 반환합니다. 파일 쓰기는 레이아웃 풀 저장만 허용됩니다 "
               "(.claude/skills/layout-pool/). 설계문서는 ui-designer, 소스는 ui-implementer가 만듭니다.")

    sys.exit(0)


if __name__ == "__main__":
    main()
