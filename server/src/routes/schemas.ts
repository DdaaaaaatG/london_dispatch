import { checkCharacterSettings } from '@shared/settings'
import type { CharacterId, SpeakTarget } from '@shared/types'
import { z } from 'zod'
import { characterSettingsSchema } from '../settings'

/** 경로 :id — 문자열 그대로. 존재 판정은 서비스(NOT_FOUND) */
export const roomIdParam = z.object({ id: z.string().min(1) })

/** 없음·빈 값 → undefined, 나머지는 Number() 변환만. 정수·범위 판정은 서비스 (messages.md D-MSG-4) */
const numberLike = z
  .string()
  .optional()
  .transform(value => (value === undefined || value.trim() === '' ? undefined : Number(value)))

/** GET /api/rooms/:id/messages 쿼리 (api.md §4.3). 모르는 키는 버린다 */
export const messagesQuery = z.object({ before: numberLike, limit: numberLike })

/**
 * undefined 키를 뺀 쿼리 객체. 서비스의 MessagePageQuery 가 exactOptionalPropertyTypes 라 undefined 값을 받지 못한다
 * (서비스 타입에 `| undefined` 가 추가되면 이 함수는 불필요 — api.md §15.2)
 */
export const toPageQuery = (query: {
  before?: number | undefined
  limit?: number | undefined
}) => ({
  ...(query.before !== undefined && { before: query.before }),
  ...(query.limit !== undefined && { limit: query.limit }),
})

/** 10진 숫자만 Number(), 그 밖은 NaN. 범위 판정·NOT_FOUND 는 서비스 (api.md §4.5) */
const toMessageId = (raw: string): number => (/^[0-9]+$/.test(raw) ? Number(raw) : Number.NaN)

/** 경로 :id — 메시지 id */
export const messageIdParam = z.object({ id: z.string().transform(toMessageId) })

/** POST /api/rooms · PATCH /api/rooms/:id 본문. 타입만 — trim·1~60자는 서비스 */
export const roomTitleBody = z.object({ title: z.string() })

/** POST /api/rooms/:id/user 본문. ooc 필수 — trim·1~2000자는 서비스 */
export const userMessageBody = z.object({ text: z.string(), ooc: z.boolean() })

/** PATCH /api/messages/:id 본문 */
export const editMessageBody = z.object({ text: z.string() })

/** CharacterId 와 같은 두 값. 캐릭터는 2명 고정(확정사항 §1) */
const CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** speak 대상 — SpeakTarget 과 같은 집합 (api.md §4.13 · §5.2, v0.6 'auto'). 캐릭터 2명 고정 + 'auto' */
const SPEAK_TARGETS = [
  ...CHARACTER_IDS,
  'auto',
] as const satisfies readonly SpeakTarget[]

/** POST /api/rooms/:id/speak 본문. 세 값 밖은 400(기본 문구) — 대소문자·공백을 고쳐 주지 않는다 (api.md §4.13) */
export const speakBody = z.object({ character: z.enum(SPEAK_TARGETS) })

/** E16 본문(PUT 캐릭터 설정). 봉투 모르는 키는 버리고, settings 안은 server 스키마가 strict (api.md §4.16) */
export const putCharacterSettingsBody = z.object({ settings: characterSettingsSchema })

/** E16 400 문구 — 판정은 zod, 문구는 shared 사전 검사의 첫 위반 1건. 둘이 어긋나면 undefined → 기본 문구 */
export const settingsIssueMessage = (data: unknown): string | undefined => {
  const settings =
    typeof data === 'object' && data !== null && 'settings' in data ? data.settings : undefined
  const checked = checkCharacterSettings(settings)
  return checked.ok ? undefined : checked.issue.message
}

/** E16 본문 상한 초과 문구 (api.md §4.16 판정 4) */
export const SETTINGS_BODY_TOO_LARGE = '공통 · 설정 본문은 128KB 이하여야 합니다.'
