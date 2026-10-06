/**
 * [목적] 모델 응답 후처리: 앞머리 이름표 제거·공백/빈 줄 정리·2000자 상한(R-LLM-004). 설계 llm.md §2.5·§7.2
 * [공개 API] postprocessLine(raw)
 * [비동기] 없음. 순수 함수
 * [에러] AppError LLM_EMPTY(502) — 결과가 빈 문자열일 때
 * [설정] 없음. 이름 목록은 @shared/characters 에서 만든다
 * [테스트] server/test/llm-prompt.test.ts (SRV-T-172·173)
 */
import { CHARACTERS } from '@shared/characters'
import { MESSAGE_TEXT_MAX } from '@shared/limits'
import { AppError } from '../app-error'

const MAX_LABEL_PASSES = 2

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 두 캐릭터의 name·shortName 4종, 긴 이름 먼저 */
const NAMES = Object.values(CHARACTERS)
  .flatMap(c => [c.name, c.shortName])
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|')

/** 앞머리 이름표: [** [ 「] 이름 [** ] 」] (: | ：) [**] 공백 */
const LABEL_PATTERN = new RegExp(
  `^(?:\\*\\*|\\[|「)?(?:${NAMES})(?:\\*\\*|\\]|」)?[:：](?:\\*\\*)?\\s*`,
)

const stripLeadingLabels = (s: string): string => {
  let out = s
  for (let i = 0; i < MAX_LABEL_PASSES; i += 1) {
    const next = out.replace(LABEL_PATTERN, '').trim()
    if (next === out) break
    out = next
  }
  return out
}

const tidyLines = (s: string): string =>
  s
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const capLength = (s: string): string => {
  const points = [...s]
  return points.length > MESSAGE_TEXT_MAX ? points.slice(0, MESSAGE_TEXT_MAX).join('').trimEnd() : s
}

/** 이름표 제거·공백 정리·2000자 상한. 결과가 비면 AppError LLM_EMPTY */
export const postprocessLine = (raw: string): string => {
  const unified = raw.replace(/\r\n?/g, '\n').trim()
  const cleaned = tidyLines(stripLeadingLabels(unified))
  if (cleaned === '') throw new AppError('LLM_EMPTY')
  return capLength(cleaned)
}
