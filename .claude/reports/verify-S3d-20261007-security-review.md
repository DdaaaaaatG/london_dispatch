# S3d security 리뷰 (verify-security-reviewer 최종 보고 원문) — 2026-10-07

> 메인 세션이 리뷰어 transcript(agent-a89c981a67a13149b.jsonl)에서 최종 보고를 그대로 옮긴 기록. 판정은 리뷰어의 것이다.

S3d 보안 리뷰 (기준 4ae7611, 미커밋 변경, 읽기 전용 — 테스트·빌드는 돌리지 않음): CRITICAL 0 / HIGH 0 / MEDIUM 0 / LOW 2

배포를 막을 보안 결함은 없습니다.

■ 이슈
[LOW] SEC-001 server/src/llm/prompt.ts:47, :52 — defang·줄바꿈 정규화가 ASCII만 처리
  근거: `defang`은 '<<' '>>'만 치환, 줄바꿈은 `\r\n?`만 정규화. 전각 꺾쇠(＜＜…＞＞)·《》와 U+2028·U+2029·U+0085가 남아 이름표 위조(둘째 줄 들여쓰기 회피) 여지. select.ts:23-24, :90이 같은 함수를 재사용.
  영향: 선택 결과는 parseSpeakerChoice(select.ts:101-107)가 sebastian/ciel 중 하나로만 받으므로 버튼 이상의 효과 없음. 생성 경로는 기존 잔여 위험.
  권고(server-manager): NFKC 정규화 선행 + `[\u2028\u2029\u0085]` → '\n'.

[LOW] SEC-002 server/src/routes/messages.ts:82, :86 · server/src/messages/generate.ts:139-157 — 'auto'는 레이트리밋 1회에 제공사 호출 최대 3회, 예산 게이트는 선택 앞 1회
  근거: rateLimitWrites 요청당 1회. selectSpeaker 1회(client.ts:226) + complete 최대 2회. 라우트 주석은 "AI 1~2회". ensureBudget은 선택 앞 1회(generate.ts:139)뿐이고 생성 전 재확인 없음.
  영향: 토큰 1개 분당 제공사 호출 상한 60회(이전 40회). 월 예산 초과분은 최대 1요청 분량. 지목 경로는 선택 호출 0회.
  권고: 주석·api.md 부수효과를 "AI 1~3회"로 정정. 분당 제공사 호출 상한 필요 시 contract-manager에 요구로.

■ 중점 점검 결과 (8개 모두 이상 없음)
1. 실명 노출 0건: 투영 지점은 db/messages.ts:37-48 toMessage 한 곳(유저 '어떠한 의지', 캐릭터 null). pageDesc :63·insert :72·updateText :79·getById :91 모두 경유. 프롬프트는 PromptMessage에서 authorName 제거(prompt.ts:20), 이름표 고정(prompt.ts:59). 로그에 displayName·chName·nick 0건. 실명은 D1 author_name에만(service.ts:90, 설계대로).
2. 이름 지목: mentionedSpeaker(select.ts:113-121) 순수 함수, 같은 방 pageDesc·잠금 안, 화자만 결정. requireToken·rateLimitWrites 선행. 권한·다른 방 영향 없음.
3. 선택 프롬프트 주입 완화: 유저 텍스트는 사용자 턴 구분자 블록 안(select.ts:88-93), 시스템에는 GUARD_RULES·defang한 world·role만(select.ts:62-65, :82-85). 출력은 두 ID 중 정확히 하나만 채택.
4. 비용: 선택 호출도 meter.record 누적(client.ts:133-146). 레이트리밋 요청당 1회(2회 아님). 화면 자동 응답은 POST messages + POST speak = 2회 카운트 → 전송 분당 최대 10회.
5. 'auto' 검증: schemas.ts:55 z.enum 정확 일치, generate.ts:70 `===` 재확인. 'Auto'·공백·유니코드 변형 400.
6. 타임아웃: 선택 min(15000, LLM_TIMEOUT_MS=60000)=15초(wrangler.toml:15), AbortSignal.timeout(gemini.ts:160). 생성 예산 66초 − spentMs(client.ts:150), 재시도도 남은 예산 내. LLM ≤ 66초, speak ≤ 70초, SPEAK_LOCK_MS 90초.
7. 로그: speaker_select는 provider·result·reason·httpStatus·outChars·ms만(client.ts:237-244). 원문 없음.
8. 일반: timingSafeEqual + 서명 길이 선검사(token.ts:82, :100), 순서 서명→payload→exp→level. 쓰기 라우트 전부 requireToken+rateLimitWrites. SQL 전부 bind. 제공사 원문 미노출(client.ts:124), 500 고정 문구(app.ts:113-117). env.ts 밖 설정 키 접근 0건. 화면 dangerouslySetInnerHTML 0건, 토큰 메모리 보관.

■ 사실 기록
- workers.dev 기본 HTTPS. 레이트리밋 분당 20회(D1 rate_limits, 키 mbId). speak 잠금 D1 조건부 UPDATE + 만료.
- frame-ancestors 출처 2개(wrangler.toml:16), app.ts:36-61에서 부착, run_worker_first로 /embed 포함.
- wrangler.toml [vars] 비밀값 없음. .dev.vars·.wrangler/·.ld-token.local gitignore 제외, 추적 0건. 실값 패턴 grep 0건. package.json 미변경 → npm audit 생략.

■ False Positive 제외
- shared characters.ts·types.ts 큰 diff는 줄 끝 문자 변경(실제 추가 USER_DISPLAY_NAME·SpeakTarget).
- 분해형 한글 지목 미인식 → LLM 선택으로 넘어갈 뿐.
- 픽스처 '미샤'는 가짜 이름. app.ts의 c.env.DB·ASSETS는 바인딩.

관련 파일: server/src/llm/{select,client,prompt}.ts, server/src/messages/generate.ts, server/src/db/messages.ts, server/src/routes/{schemas,messages}.ts, server/wrangler.toml, ui/src/chat/useMessageWrites.ts (루트 D:\woon\pr\bbs_action_sample\london_dispatch)
