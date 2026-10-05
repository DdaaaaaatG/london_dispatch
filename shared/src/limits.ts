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
