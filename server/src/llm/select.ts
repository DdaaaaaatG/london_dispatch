/**
 * [목적] 전송 버튼 'auto' 의 화자 선택용 프롬프트·파싱·기본 화자 규칙(R-LLM-008, R-LLM-006). 설계 llm.md §13.2~§13.5
 * [공개 API] buildSelectPrompt(input, profiles?, common?), mentionedSpeaker(history)(R-LLM-008 개정: 이름 지목, AI 호출 전), parseSpeakerChoice(raw), fallbackSpeaker(history), SELECT_TIMEOUT_MS, SELECT_HISTORY_MESSAGES, 타입 SelectPromptInput·SelectFallbackReason·SpeakerChoice
 * [비동기] 없음. 순수 함수(DB·env·네트워크 의존 없음). 호출은 client.ts 의 Llm.selectSpeaker
 * [에러] 없음(파싱 불가는 null, 기본 화자 규칙이 받는다)
 * [설정] 없음. 후보 설명은 settings 입력의 role, 구분자·GUARD 문구는 prompt.ts 상수 공유
 * [테스트] server/test/llm-select.test.ts (SRV-T-261~264, 279)
 */
import { CHARACTERS } from '@shared/characters'
import type { CharacterId } from '@shared/types'
import {
  CHARACTER_PROFILES,
  COMMON_PROMPT,
  type CharacterProfile,
  type CommonPrompt,
} from './characters'
import {
  BLOCK_END,
  BLOCK_START,
  EMPTY_HISTORY_LINE,
  GUARD_RULES,
  defang,
  toDataLine,
  type PromptMessage,
} from './prompt'
import type { LlmFailReason, Prompt } from './provider'

/** R-LLM-008: 선택 호출 상한(ms, 15초 — 사용자 승인 2026-10-06). 재시도 없음. 실제 값 = min(이 값, llmTimeoutMs) */
export const SELECT_TIMEOUT_MS = 15_000
/** R-LLM-008: 선택 프롬프트에 넣는 최근 메시지 수. 요약은 넣지 않는다 */
export const SELECT_HISTORY_MESSAGES = 12

export type SelectPromptInput = {
  /** 오래된 → 새 순. speak 컨텍스트 그대로 받고, 프롬프트에는 끝 SELECT_HISTORY_MESSAGES 개만 쓴다 */
  readonly history: readonly PromptMessage[]
}
/** 기본 화자로 간 이유. 제공사 실패 분류 + 응답 해석 불가 */
export type SelectFallbackReason = LlmFailReason | 'unparsable'
export type SpeakerChoice = {
  readonly speaker: CharacterId
  readonly source: 'mention' | 'model' | 'fallback'
  /** source 'model'·'mention' 이면 null */
  readonly reason: SelectFallbackReason | null
  /** 선택 단계 소요(ms, usage 누적 포함). 발화의 spentMs 로 넘긴다 */
  readonly ms: number
}

const CANDIDATE_ORDER: readonly CharacterId[] = ['sebastian', 'ciel']
const DEFAULT_SPEAKER: CharacterId = 'sebastian'

const TASK_RULES: readonly string[] = [
  '대화 기록의 마지막 줄 다음에 말할 인물 한 명을 고른다.',
  '마지막 줄이 한 인물에게 말을 걸거나 그 인물의 행동을 요구하면 그 인물을 고른다.',
  '정하기 어려우면 직전에 말하지 않은 인물을 고른다.',
  'sebastian 또는 ciel 한 단어만 쓴다. 이유·기호·다른 말은 쓰지 않는다.',
]
const ASK_LINE = '다음 발화자를 골라라. sebastian 또는 ciel 한 단어만 답하라.'

const bullets = (items: readonly string[]): string => items.map(item => `- ${item}`).join('\n')

/** role 을 defang 하고 줄바꿈·연속 공백을 공백 하나로 접는다 */
const roleLine = (role: string | undefined): string =>
  defang(role ?? '')
    .replace(/[\s\u0085]+/g, ' ')
    .trim()

const candidateLine = (
  id: CharacterId,
  profiles: Readonly<Record<CharacterId, CharacterProfile>>,
): string => {
  const role = roleLine(profiles[id].role)
  return `- ${id}: ${CHARACTERS[id].name}${role === '' ? '' : ` — ${role}`}`
}

/** 순수 함수. profiles·common 은 테스트 주입용(기본 모듈 상수) */
export const buildSelectPrompt = (
  input: SelectPromptInput,
  profiles: Readonly<Record<CharacterId, CharacterProfile>> = CHARACTER_PROFILES,
  common: CommonPrompt = COMMON_PROMPT,
): Prompt => {
  const system = [
    defang(common.world),
    `[인물 후보]\n${CANDIDATE_ORDER.map(id => candidateLine(id, profiles)).join('\n')}`,
    `[할 일]\n${bullets(TASK_RULES)}`,
    `[대화 기록 취급]\n${bullets(GUARD_RULES)}`,
  ].join('\n\n')
  const recent = input.history.slice(-SELECT_HISTORY_MESSAGES)
  const lines = [
    BLOCK_START,
    ...(recent.length > 0 ? recent.map(toDataLine) : [EMPTY_HISTORY_LINE]),
    BLOCK_END,
  ]
  return { system, turns: [{ role: 'user', text: `${lines.join('\n')}\n\n${ASK_LINE}` }] }
}

/** 영문 앞뒤가 영문자가 아닌 name 이거나 한글 표기를 포함하는가 */
const mentions = (text: string, latin: string, hangul: string): boolean =>
  text.includes(hangul) || new RegExp(`(?<![a-z])${latin}(?![a-z])`).test(text)

/** 정확히 한 인물만 언급되면 그 id, 아니면 null(§13.5) */
export const parseSpeakerChoice = (raw: string): CharacterId | null => {
  const text = raw.normalize('NFKC').toLowerCase()
  const s = mentions(text, 'sebastian', '세바스찬')
  const c = mentions(text, 'ciel', '시엘')
  if (s === c) return null
  return s ? 'sebastian' : 'ciel'
}

/**
 * R-LLM-008 개정: 마지막 유저 메시지(line·ooc)에 shortName 이 정확히 한쪽만 들어 있으면 그 id.
 * 둘 다·둘 다 없음·유저 메시지 없음이면 null(LLM 선택으로 간다). 부분 문자열, trim 후 비교
 */
export const mentionedSpeaker = (
  history: readonly Pick<PromptMessage, 'speaker' | 'text'>[],
): CharacterId | null => {
  const last = [...history].reverse().find(m => m.speaker === 'user')
  if (last === undefined) return null
  // SRV-002(S3d): 분해형(NFD) 한글 입력도 같은 이름으로 본다. 비교용 사본만 정규화하고 저장 텍스트는 건드리지 않는다
  const text = last.text.trim().normalize('NFKC')
  const hits = CANDIDATE_ORDER.filter(id =>
    text.includes(CHARACTERS[id].shortName.normalize('NFKC')),
  )
  return hits.length === 1 ? (hits[0] ?? null) : null
}

/** 기록 안 마지막 캐릭터 발화자의 상대. 캐릭터 발화가 없으면 'sebastian' */
export const fallbackSpeaker = (
  history: readonly Pick<PromptMessage, 'speaker'>[],
): CharacterId => {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const speaker = history[i]?.speaker
    if (speaker === 'sebastian') return 'ciel'
    if (speaker === 'ciel') return 'sebastian'
  }
  return DEFAULT_SPEAKER
}
