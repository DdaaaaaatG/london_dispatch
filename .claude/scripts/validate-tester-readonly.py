#!/usr/bin/env python
"""ui-tester 전용: PreToolUse(Write|Edit) 가드 (Python).

목적: 테스터는 시나리오를 실행·기록만 한다. 소스(.tsx/.ts 등)를 고치지 않는다(수정은 ui-fixer/ui-implementer).
허용: 화면 폴더의 test/ 하위(`ui/src/{rooms|chat}/test/**` — result.md·screenshots/), 그리고 `.claude/reports/`만.
그 외 경로 쓰기는 차단한다.

설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import re
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
        _block("ui-tester: 쓰기 대상 경로를 확인할 수 없어 차단합니다. "
               "테스터는 화면 폴더의 test/ 또는 .claude/reports/ 에만 기록합니다.")
    if "/../" in path or path.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + path)

    in_screen_test = re.search(r"(^|/)ui/src/(rooms|chat)/test/", path) is not None
    in_reports = (".claude/reports/" in path) or path.startswith("reports/")

    if not (in_screen_test or in_reports):
        _block("ui-tester는 읽기·실행 전용입니다. 소스 수정은 ui-fixer/ui-implementer가 합니다. "
               "쓰기는 화면 폴더의 test/(result.md·screenshots/)나 .claude/reports/ 에만 허용됩니다. "
               "수정이 필요하면 실패 원인을 1차 분류와 함께 보고하세요.")

    sys.exit(0)


if __name__ == "__main__":
    main()
