#!/usr/bin/env python
"""contract-implementer 전용: PreToolUse(Write|Edit) 가드 (Python).

목적: contract 구현자는 **계약 코드(shared 타입 · 서버 라우트 · 화면 api 래퍼)와 그 테스트만** 만든다.
      - server 서비스 모듈(server/src/{env,db,auth,rooms,messages,memory,llm}) 내부 수정은 server 소관 → 차단.
      - 화면 코드(ui/src/{rooms,chat,components,state})는 ui 소관 → 차단.
      - package.json / railway.json / .env* 변경은 메인 세션 승인 사항 → 차단(보고로 대체).
허용 경로(프로젝트 루트 기준, 아래 접두어 중 하나):
      shared/ · server/src/routes/ · server/test/routes/ · ui/src/api/ · ui/src/api/__tests__/ · doc/200_설계/contract/
설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import os
import re
import sys

ALLOWED_PREFIXES = (
    "shared/",
    "server/src/routes/",
    "server/test/routes/",
    "ui/src/api/",
    "ui/src/api/__tests__/",
    "doc/200_설계/contract/",
)


def _read_stdin_utf8() -> str:
    return sys.stdin.buffer.read().decode("utf-8", errors="replace")


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
    """프로젝트 루트(CLAUDE_PROJECT_DIR) 기준 상대 경로. 루트 밖 절대 경로는 그대로 두어 fail-closed."""
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
    raw = _read_stdin_utf8()
    path = _file_path(raw)
    if not path:
        _block("대상 파일 경로를 확인할 수 없습니다(fail-closed). contract-implementer는 허용 경로에만 씁니다.")

    rel = _normalize(path)
    low = rel.lower()
    if "/../" in low or low.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + rel)

    if any(low.startswith(prefix.lower()) for prefix in ALLOWED_PREFIXES):
        sys.exit(0)

    if low.startswith("server/src/") or low.startswith("server/test/"):
        _block(f"'{rel}' 은 server 서비스 모듈입니다. server 내부 수정은 server-implementer 소관입니다 — "
               "필요한 변경을 「server 변경 요구 명세」로 보고하세요(server-manager).")
    if re.match(r"ui/src/(rooms|chat|components|state)/", low) or low == "ui/src/main.tsx":
        _block(f"'{rel}' 은 화면 코드입니다. ui-implementer 소관입니다 — 계약 변경이면 api.md 호환성 분류로 ui-manager에 인계하세요.")
    if re.search(r"(^|/)(package\.json|railway\.json|vite\.config\.ts|tsconfig[^/]*\.json|\.env[^/]*)$", low):
        _block(f"'{rel}' 변경(의존성·배포·환경 설정)은 메인 세션 승인 사항입니다. 필요한 설정·의존성을 보고하세요.")
    _block(f"'{rel}' 은 contract-implementer 허용 경로가 아닙니다. 허용: " + ", ".join(ALLOWED_PREFIXES))


if __name__ == "__main__":
    main()
