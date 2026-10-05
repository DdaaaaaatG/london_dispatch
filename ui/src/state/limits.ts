/**
 * 글자 수·한도 — 설계 rooms/design/components.md §1.11 · F-RM-23 · 요구 R-ROOM-002 · R-MSG-002
 * 한도 숫자와 "trim 후 코드 포인트" 규칙은 계약 단일 소스 @shared/limits(api.md §5.7)를 그대로 쓴다(CR-C-2 반영).
 * 이모지 1개 = 1자. maxLength 속성은 쓰지 않는다(UTF-16 단위라 어긋나고 붙여넣기를 말없이 자른다).
 */
import { MESSAGE_TEXT_MAX, ROOM_TITLE_MAX, countCodePoints, normalizeText } from '@shared/limits'

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
