#!/usr/bin/env python
"""server-implementer 전용: PreToolUse(Write|Edit) 가드 (Python).

목적: server 구현자는 **서버 서비스 모듈과 그 테스트만** 만든다.
      - 라우트(server/src/routes/, server/test/routes/)는 contract 소관 → 차단.
      - shared/ · ui/ 는 각각 contract · ui 소관 → 차단.
      - package.json / tsconfig / server/.dev.vars(실파일) 변경은 메인 세션 승인·사용자 입력 사항 → 차단.
허용 경로(프로젝트 루트 기준):
      server/src/**(routes 제외) · server/test/**(routes 제외) · server/migrations/**(D1 마이그레이션 SQL) ·
      server/wrangler.toml(바인딩·[vars]·[assets]) · server/.dev.vars.example(로컬 비밀값 키 목록, 실값 없음) ·
      doc/200_설계/server/**(설계 문서의 「구현 완료」 마커 기록용 — 본문 재작성은 server-designer 소관)
설계 원칙: fail-closed — 경로를 못 찾거나 허용 목록 밖이면 막는다.
종료코드 2 = 차단(사유 stderr). 0 = 허용.
"""
import json
import os
import re
import sys


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
        _block("대상 파일 경로를 확인할 수 없습니다(fail-closed). server-implementer는 허용 경로에만 씁니다.")

    rel = _normalize(path)
    low = rel.lower()
    if "/../" in low or low.startswith("../"):
        _block("상위 폴더(..)가 들어간 경로는 차단합니다: " + rel)

    if low.startswith("server/src/routes/") or low.startswith("server/test/routes/"):
        _block(f"'{rel}' 은 라우트(contract 계층)입니다. contract-implementer 소관입니다 — "
               "엔드포인트·응답 형식 변경이 필요하면 「contract 변경 요구 명세」로 보고하세요(contract-manager).")
    if low.startswith("server/src/") or low.startswith("server/test/") or low.startswith("server/migrations/"):
        sys.exit(0)
    if low in ("server/wrangler.toml", "server/.dev.vars.example"):
        sys.exit(0)
    if low.startswith("doc/200_설계/server/"):
        sys.exit(0)
    if re.search(r"(^|/)\.dev\.vars([^/]*)$", low):
        _block(f"'{rel}' 은 로컬 비밀값 실파일입니다. 실값은 사용자가 직접 넣습니다(운영은 wrangler secret put). 키 이름·설명만 server/.dev.vars.example 에 적으세요.")

    if low.startswith("shared/"):
        _block(f"'{rel}' 은 계약 타입(contract 계층)입니다. contract-implementer 소관입니다.")
    if low.startswith("ui/"):
        _block(f"'{rel}' 은 화면 코드입니다. ui-implementer 소관입니다.")
    if re.search(r"(^|/)(package\.json|wrangler\.toml|vite\.config\.ts|tsconfig[^/]*\.json|\.env[^/]*)$", low):
        _block(f"'{rel}' 변경(의존성·빌드·환경 설정)은 메인 세션 승인 사항입니다. 필요한 설정·의존성을 보고하세요(server/wrangler.toml 만 server-implementer 허용).")
    _block(f"'{rel}' 은 server-implementer 허용 경로가 아닙니다. 허용: server/src/**(routes 제외), server/test/**(routes 제외), server/migrations/, server/wrangler.toml, server/.dev.vars.example, doc/200_설계/server/")


if __name__ == "__main__":
    main()
