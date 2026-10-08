/**
 * 글자 수·한도 — 설계 rooms/design/components.md §1.11 · F-RM-23 · F-RM-39(S6 비밀번호) · 요구 R-ROOM-002 · R-MSG-002 · R-LOCK-001
 * 한도 숫자와 "trim 후 코드 포인트" 규칙은 계약 단일 소스 @shared/limits(api.md §5.7)를 그대로 쓴다(CR-C-2 반영).
 * 이모지 1개 = 1자. maxLength 속성은 쓰지 않는다(UTF-16 단위라 어긋나고 붙여넣기를 말없이 자른다).
 */
import {
  MESSAGE_TEXT_MAX,
  ROOM_ENTER_PASSWORD_MAX,
  ROOM_PASSWORD_MAX,
  ROOM_PASSWORD_MIN,
  ROOM_TITLE_MAX,
  countCodePoints,
  normalizeText,
} from '@shared/limits'

/** 방 제목 최대 글자 수 */
export const ROOM_TITLE_MAX_CHARS = ROOM_TITLE_MAX
/** 메시지 본문 최대 글자 수 */
export const MESSAGE_TEXT_MAX_CHARS = MESSAGE_TEXT_MAX

/** 앞뒤 공백을 뺀 코드 포인트 수 */
export const countChars = (value: string): number => countCodePoints(normalizeText(value))

const isWithin = (value: string, max: number): boolean => {
  const count = countChars(value)
  return count >= 1 && count <= max
}

/** 방 제목이 1 이상 60 이하인가 */
export const isRoomTitleValid = (value: string): boolean => isWithin(value, ROOM_TITLE_MAX_CHARS)

/** 메시지 본문이 1 이상 2000 이하인가 */
export const isMessageTextValid = (value: string): boolean =>
  isWithin(value, MESSAGE_TEXT_MAX_CHARS)

/** (S6) 비밀번호 글자 수 — trim 없이 코드 포인트(공백도 글자다, R-LOCK-001) */
export const countPasswordChars = (value: string): number => countCodePoints(value)

/** 4 이상 32 이하인가 — 잠금 설정·변경(빈칸 불가) */
export const isRoomPasswordSettable = (value: string): boolean => {
  const count = countPasswordChars(value)
  return count >= ROOM_PASSWORD_MIN && count <= ROOM_PASSWORD_MAX
}

/** 새 방 비밀번호 칸 — 빈칸(잠그지 않음)이거나 설정 가능한 길이인가 */
export const isRoomPasswordValid = (value: string): boolean =>
  value === '' || isRoomPasswordSettable(value)

/** 입장 시트 — 1 이상 64 이하인가(4~32 는 보지 않는다, 틀림은 서버가 판정한다) */
export const isEnterPasswordValid = (value: string): boolean => {
  const count = countPasswordChars(value)
  return count >= 1 && count <= ROOM_ENTER_PASSWORD_MAX
}
