#!/usr/bin/env python
"""ui 생성자 공용: PreToolUse(Write|Edit) 가드 (Python).

호출자: ui-implementer, ui-fixer, ui-debug, ui-postprocessor, ui-component-implementer
목적: 화면 생성자는 **ui/src/ 안(화면·컴포넌트·상태·스타일·main.tsx)과 화면 문서·테스트만** 쓴다.
      - ui/src/api/ 는 contract 소관(화면 fetch 래퍼) → 차단. 계약이 모자라면 「contract 변경 요구 명세」로 보고.
      - server/ · shared/ · doc/200_설계/ 는 소관 밖 → 차단.
      - package.json / vite.config.ts / tsconfig / railway.json / .env* 와 .claude/ 는 메인 세션 → 차단.
허용 경로(프로젝트 루트 기준):
      ui/src/**(api/ 제외) · ui/index.html · ui/src/{rooms|chat}/**.md · ui/src/{rooms|chat}/test/** ·
      .claude/skills/component-catalog/SKILL.md · .claude/skills/component-usage-lessons/SKILL.md (카탈로그 갱신)
설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import os
import re
import sys

CATALOG_FILES = (
    ".claude/skills/component-catalog/skill.md",
    ".claude/skills/component-usage-lessons/skill.md",
)


def _file_path(raw: str) -> str:
    try:
        data = json.loads(raw)
        ti = data.get("tool_input") or {}
        for key in ("file_path", "path", "filePath", "notebook_path"):
            v = ti.get(key)
            if isinstance(v, str) and v.strip():
                return v
        return ""
    except Exception:
        m = re.search(r'"(?:file_path|path|filePath|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
        return m.group(1) if m else ""


def _unify(path: str) -> str:
    p = path.replace("\\", "/")
    m = re.match(r"^/([a-zA-Z])/(.*)$", p)
    if m:
        p = f"{m.group(1)}:/{m.group(2)}"
    return p


def _normalize(path: str) -> str:
    p = _unify(path)
    root = _unify(os.environ.get("CLAUDE_PROJECT_DIR", "")).rstrip("/")
    if root and p.lower().startswith(root.lower() + "/"):
        p = p[len(root) + 1:]
    p = re.sub(r"^\./", "", p)
    return p


def _block(message: str) -> None:
    sys.stderr.write("Blocked: " + message + "\n")
    sys.exit(2)


def main() -> None:
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    path = _file_path(raw)
    if not path:
        _block("대상 파일 경로를 확인할 수 없습니다(fail-closed). ui 생성자는 ui/src/ 안에만 씁니다.")

    rel = _normalize(path)
    low = rel.lower()
    if "/../" in low or low.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + rel)

    if low.startswith("ui/src/api/"):
        _block(f"'{rel}' 은 화면 api 래퍼(contract 계층)입니다. contract-implementer 소관입니다 — "
               "엔드포인트가 모자라면 「contract 변경 요구 명세」로 보고하세요(contract-manager).")
    if low.startswith("ui/src/") or low == "ui/index.html":
        sys.exit(0)
    if low in CATALOG_FILES:
        sys.exit(0)

    if low.startswith("server/"):
        _block(f"'{rel}' 은 서버 코드입니다. server-implementer 소관입니다 — 「server 변경 요구 명세」로 보고하세요.")
    if low.startswith("shared/"):
        _block(f"'{rel}' 은 계약 타입(contract 계층)입니다. contract-implementer 소관입니다.")
    if low.startswith("doc/200_설계/"):
        _block(f"'{rel}' 은 설계 문서입니다. server-designer/contract-designer 소관이며 화면 문서는 ui/src/{{화면}}/design.md 에 씁니다.")
    if re.search(r"(^|/)(package\.json|railway\.json|vite\.config\.ts|tsconfig[^/]*\.json|\.env[^/]*)$", low):
        _block(f"'{rel}' 변경(의존성·빌드·환경 설정)은 메인 세션 승인 사항입니다. 필요한 설정·의존성을 보고하세요.")
    if low.startswith(".claude/") or low == "claude.md":
        _block(f"'{rel}' 은 Claude 자산입니다. 생성자는 고치지 않습니다(카탈로그 스킬 2종만 예외).")
    _block(f"'{rel}' 은 ui 생성자 허용 경로가 아닙니다. 허용: ui/src/**(api/ 제외), ui/index.html, 화면 문서·test/, 카탈로그 스킬 2종")


if __name__ == "__main__":
    main()
