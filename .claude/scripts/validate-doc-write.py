#!/usr/bin/env python
"""문서 작성자 전용: PreToolUse(Write|Edit) 가드 (Python).

대상: ui-designer · ui-test-designer · server-designer · contract-designer · ui-component-designer · ui-manual-writer
목적: 설계·시나리오·매뉴얼 작성자는 **문서와 테스트 스펙만** 쓴다. 제품 소스(.ts/.tsx/.js)와
      설정 파일(package.json·railway.json·vite.config.ts·tsconfig 등), 그리고 `CLAUDE.md`·`.claude/**`
      (에이전트·스킬·훅 정의)는 소관 밖이므로 차단한다.

허용
- `doc/` 아래 전부(.md/.json/.png 등 — 요구·설계·계약·handoff·검증)
- 화면 폴더 문서: `ui/src/{rooms|chat}/(requirements|design|manual).md`, `ui/src/{rooms|chat}/design/*.md`
- 화면 테스트: `ui/src/{rooms|chat}/test/**` (scenarios.md · *.test.tsx · manual-checklist.md · change-requests.md)
- 매뉴얼 이미지: `ui/src/{rooms|chat}/manual/img/**`
- 컴포넌트 설계: `ui/src/components/ui/{Name}/COMPONENT.md`
- `.claude/reports/` 아래

차단
- `CLAUDE.md`, `.claude/**`(reports 제외) — kuro 자산의 ".md면 어디든" 구멍을 막는다
- 위 허용 밖의 모든 `.ts/.tsx/.js/.jsx/.json/.css` 및 그 밖의 경로

설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import os
import re
import sys

try:
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SCREENS = "(rooms|chat)"


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


def _normalize(path: str) -> str:
    p = path.replace("\\", "/")
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1)}:/{m.group(2)}"
    p = re.sub(r"/{2,}", "/", p)
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").replace("\\", "/").rstrip("/")
    if root and p.lower().startswith(root.lower() + "/"):
        p = p[len(root) + 1:]
    p = re.sub(r"^\./", "", p)
    return p.lower()


def _is_allowed(path: str) -> bool:
    if "/../" in path or path.startswith("../"):
        return False
    base = path.rsplit("/", 1)[-1]
    if base == "claude.md":
        return False
    if path.startswith(".claude/reports/") or "/.claude/reports/" in path:
        return True
    if path.startswith(".claude/") or "/.claude/" in path:
        return False
    if path.startswith("doc/") or "/doc/" in path:
        return True
    if re.search(rf"(^|/)ui/src/{SCREENS}/(requirements|design|manual)\.md$", path):
        return True
    if re.search(rf"(^|/)ui/src/{SCREENS}/design/[^/]+\.md$", path):
        return True
    if re.search(rf"(^|/)ui/src/{SCREENS}/test/", path):
        return True
    if re.search(rf"(^|/)ui/src/{SCREENS}/manual/img/", path):
        return True
    if re.search(r"(^|/)ui/src/components/ui/[^/]+/COMPONENT\.md$", path, re.I):
        return True
    return False


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    path = _normalize(_file_path(raw))

    if not path:
        _block("문서 작성자: 쓰기 대상 경로를 확인할 수 없어 차단합니다. "
               "허용 범위는 doc/ · ui/src/{rooms|chat}/ 문서·test/ · COMPONENT.md · .claude/reports/ 입니다.")

    if _is_allowed(path):
        sys.exit(0)

    base = path.rsplit("/", 1)[-1]
    if base == "claude.md" or path.startswith(".claude/") or "/.claude/" in path:
        _block("문서 작성자는 CLAUDE.md·.claude/ 자산(에이전트·스킬·훅)을 고치지 않습니다. 필요한 변경은 보고만 하세요: " + path)
    _block("문서 작성자는 doc/ · 화면 문서(requirements/design/manual.md) · 화면 test/ · COMPONENT.md · .claude/reports/ 만 씁니다. "
           f"'{path}' 는 제품 소스 또는 설정 파일입니다 — 구현은 implementer 소관입니다.")


if __name__ == "__main__":
    main()
