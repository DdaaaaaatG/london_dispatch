/**
 * [목적] 메시지 본문 규칙·메시지 id 판정 순수 함수 (R-MSG-002·004·005). 설계 messages.md §2.2
 * [공개 API] normalizeMessageText(raw), isMessageId(id), MESSAGE_TEXT_MAX(@shared/limits 재노출)
 * [비동기] 없음(순수)
 * [에러] AppError VALIDATION_ERROR('메시지는 1~2000자로 입력해 주세요.')
 * [설정] 없음. 2000 은 shared/src/limits.ts 가 단일 소스
 * [테스트] server/test/messages.test.ts (SRV-T-143·147·149)
 */
import { countCodePoints, MESSAGE_TEXT_MAX, normalizeText } from '@shared/limits'
import { AppError } from '../app-error'

export { MESSAGE_TEXT_MAX }

const TEXT_MESSAGE = `메시지는 1~${MESSAGE_TEXT_MAX}자로 입력해 주세요.`

/** trim 후 코드 포인트 1~2000자면 trim 결과를, 아니면 AppError VALIDATION_ERROR */
export const normalizeMessageText = (raw: string): string => {
  const text = normalizeText(raw)
  const length = countCodePoints(text)
  if (length < 1 || length > MESSAGE_TEXT_MAX) throw new AppError('VALIDATION_ERROR', TEXT_MESSAGE)
  return text
}

/** 메시지 id 로 쓸 수 있는 값인가 (1 이상 안전 정수) */
export const isMessageId = (id: number): boolean => Number.isSafeInteger(id) && id >= 1
