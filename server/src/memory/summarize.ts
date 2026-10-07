/**
 * [목적] 장기기억 자동 요약의 순수 판단 함수와 상수: 기준 판정·배치 크기·입력 글자 상한·출력 길이 맞춤(R-MEM-001 4000자, R-MEM-002). 설계 memory.md §2·§2.1
 * [공개 API] planSummary, pendingCountCap, capByChars, fitSummary, SUMMARY_BATCH_MAX, SUMMARY_INPUT_CHARS_MAX, SUMMARY_CUT_MIN
 * [비동기] 없음. 순수 함수(DB·env·네트워크 의존 없음)
 * [에러] 없음
 * [설정] 없음. 임계값·컨텍스트 수는 인자로 받는다(config 값을 서비스가 전달)
 * [테스트] server/test/memory.test.ts (SRV-T-296~298)
 */
import { countCodePoints, MEMORY_SUMMARY_MAX } from '@shared/limits'
import type { PromptMessage } from '../llm'

/** 요약 1회에 넣는 메시지 수 상한 */
export const SUMMARY_BATCH_MAX = 100
/** 요약 1회에 넣는 메시지 본문 합계 상한(코드 포인트) */
export const SUMMARY_INPUT_CHARS_MAX = 20_000
/** 넘친 출력을 자를 때 경계(줄·문장 끝)를 찾는 최소 위치. 이보다 앞이면 상한에서 그냥 자른다 */
export const SUMMARY_CUT_MIN = 3_000

const SENTENCE_ENDS: ReadonlySet<string> = new Set(['\n', '.', '!', '?', '。', '…'])

/** 미요약 메시지 수 → 이번에 요약할 개수. 기준 이하면 0. 순수 */
export const planSummary = (pending: number, threshold: number, contextMessages: number): number =>
  pending <= threshold ? 0 : Math.min(pending - contextMessages, SUMMARY_BATCH_MAX)

/** countAfter 상한. 기준 판정과 배치 크기 계산에 필요한 만큼만 센다. 순수 */
export const pendingCountCap = (threshold: number, contextMessages: number): number =>
  Math.max(threshold, contextMessages + SUMMARY_BATCH_MAX) + 1

/** 앞에서부터 본문 합계 ≤ maxChars 인 접두부(최소 1개). 순수 */
export const capByChars = <T extends PromptMessage>(
  rows: readonly T[],
  maxChars: number = SUMMARY_INPUT_CHARS_MAX,
): T[] => {
  const out: T[] = []
  let total = 0
  for (const row of rows) {
    total += countCodePoints(row.text)
    if (total > maxChars && out.length > 0) break
    out.push(row)
  }
  return out
}

/** ≤ max 면 그대로, 넘으면 줄·문장 경계(≥ SUMMARY_CUT_MIN)에서, 없으면 max 에서 자른다. 순수 */
export const fitSummary = (
  text: string,
  max: number = MEMORY_SUMMARY_MAX,
): { text: string; truncated: boolean } => {
  const points = [...text]
  if (points.length <= max) return { text, truncated: false }
  const head = points.slice(0, max)
  let cut = max
  for (let i = head.length - 1; i >= SUMMARY_CUT_MIN - 1; i -= 1) {
    if (SENTENCE_ENDS.has(head[i] ?? '')) {
      cut = i + 1
      break
    }
  }
  return { text: head.slice(0, cut).join('').trimEnd(), truncated: true }
}
