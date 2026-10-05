/**
 * [목적] 방 제목 규칙 순수 함수: trim 후 코드 포인트 1~60자 (R-ROOM-002·003). 설계 rooms.md §2.1
 * [공개 API] normalizeTitle(raw), ROOM_TITLE_MAX(@shared/limits 재노출)
 * [비동기] 없음(순수)
 * [에러] AppError VALIDATION_ERROR('방 제목은 1~60자로 입력해 주세요.')
 * [설정] 없음. 60 은 shared/src/limits.ts 가 단일 소스
 * [테스트] server/test/rooms.test.ts (SRV-T-131·133)
 */
import { countCodePoints, normalizeText, ROOM_TITLE_MAX } from '@shared/limits'
import { AppError } from '../app-error'

export { ROOM_TITLE_MAX }

const TITLE_MESSAGE = `방 제목은 1~${ROOM_TITLE_MAX}자로 입력해 주세요.`

/** trim 후 코드 포인트 1~60자면 trim 결과를, 아니면 AppError VALIDATION_ERROR */
export const normalizeTitle = (raw: string): string => {
  const title = normalizeText(raw)
  const length = countCodePoints(title)
  if (length < 1 || length > ROOM_TITLE_MAX) throw new AppError('VALIDATION_ERROR', TITLE_MESSAGE)
  return title
}
