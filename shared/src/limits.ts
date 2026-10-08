/**
 * 길이 상수·규칙 — 단일 소스 doc/200_설계/contract/api.md §5.7
 * 서버 서비스(trim·길이 판정)와 화면(입력 제한·글자 수 표시)이 같이 import 한다
 * 규칙: 앞뒤 trim 후 코드 포인트 수로 센다. DB CHECK length() 와 같은 단위다(이모지 1개 = 1자)
 */

/** 방 제목 최대 글자 수. 최소 1 (R-ROOM-002 · R-ROOM-003) */
export const ROOM_TITLE_MAX = 60

/** 메시지 본문 최대 글자 수. 최소 1 (R-MSG-002 · R-MSG-004 · R-CHAT-004) */
export const MESSAGE_TEXT_MAX = 2000

/** 장기기억 요약 최대 글자 수. 최소 0 — 빈 요약 허용 (R-MEM-001 · R-CHAT-012, S4에서 사용) */
export const MEMORY_SUMMARY_MAX = 4000

/** 코드 포인트 수. UTF-16 길이와 다르다('😀'.length === 2, countCodePoints('😀') === 1) */
export const countCodePoints = (s: string): number => [...s].length

/** 판정·저장 전 정규화. 앞뒤 공백·줄바꿈만 지우고 중간은 그대로 둔다 */
export const normalizeText = (s: string): string => s.trim()

/** (S6) 방 비밀번호 코드 포인트 범위 — 화면 카운터·서버 판정 공용. trim 없음 (R-LOCK-001 · api.md §5.10.4) */
export const ROOM_PASSWORD_MIN = 4
export const ROOM_PASSWORD_MAX = 32
/** (S6) E17 입장 시도 비밀번호 상한 — 해시 비용 상한, 넘으면 400 */
export const ROOM_ENTER_PASSWORD_MAX = 64
/** (S6) X-Room-Key 값 길이 상한 — 넘으면 무효(400 아님, 관문 결과 ROOM_LOCKED) */
export const ROOM_KEY_MAX_LENGTH = 128
