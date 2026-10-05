---
paths:
  - "CLAUDE.md"
  - ".claude/**/*.md"
---

# Claude 문서의 실행 명령은 프로젝트 루트 기준 상대 경로

**`CLAUDE.md`·`.claude/**/*.md`의 실행 명령에 절대 경로를 쓰지 않는다.**
`cd D:/some/path/london_dispatch/server && npx vitest run` 같은 표기는 금지다. `npx vitest run server`로 쓴다.

- 모든 명령은 **프로젝트 루트가 작업 디렉터리**라는 전제로 적는다(`server/`·`shared/`·`ui/`·`doc/`).
- 드라이브 문자와 설치 위치를 박으면 다른 클론·다른 PC·Railway 빌드에서 그대로 깨진다.
- 실행 시점에 정해지는 경로(SQLite 파일, Railway Volume)는 환경변수(`DATABASE_PATH`, `/app/data`)로 적는다.
- 외부 사이트 주소(`http://london-gossip.my`)는 **값**이지 경로가 아니므로 써도 된다. 단 허용 출처 목록의 단일 소스는 `server/src/env.ts`(`ALLOWED_FRAME_ANCESTORS`)다.
- 예외는 **기록물**뿐이다. `.claude/reports/`(분석 시점의 사실)는 그때의 경로를 그대로 둔다.

> 이 규칙 파일은 `paths` 조건부 로드다. 위 경로의 파일을 **읽을 때** 로드된다. 새 파일을 읽지 않고 `Write`할 때는 걸리지 않으므로 같은 규칙 한 줄이 CLAUDE.md에도 있다.
