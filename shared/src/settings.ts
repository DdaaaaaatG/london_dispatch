/**
 * 캐릭터 설정 규칙 — 단일 소스 doc/200_설계/contract/api.md §5.8 · §16 (R-SET-002 · R-SET-005 · R-SET-007 · R-SET-008)
 * 필드 화면 이름·필수·상한, 파일 형식 상수, 바이트 상한, 저장 전 사전 검사(400 문구 단일 소스)
 * server(zod 스키마가 상한을 import, routes 400 문구)와 ui(입력 제한·사전 검사·내보내기·가져오기)가 같이 쓴다
 * zod 를 쓰지 않는다(화면 번들 의존 금지, §5.6). 런타임 중립(브라우저·workerd 공용)
 */
import { CHARACTERS } from './characters'
import { countCodePoints, normalizeText } from './limits'
import type { CharacterId, CharacterSettingFields, CharacterSettings, LlmModelKey } from './types'

/** 내보내기 파일 식별자 (§16.1) */
export const SETTINGS_FILE_FORMAT = 'london-dispatch/character-settings'

/** 내보내기 파일 형식 버전. 가져오기는 이 값만 받는다 (§16.2) */
export const SETTINGS_FILE_FORMAT_VERSION = 1

/** PUT 본문 상한(바이트, 128KB). 넘으면 400 (R-SET-005, §4.16) */
export const SETTINGS_BODY_MAX_BYTES = 128 * 1024

/** 가져오기 파일 상한(바이트, 5MB). 화면이 읽기 전에 거부한다 (R-SET-008, §16.2) */
export const SETTINGS_IMPORT_MAX_BYTES = 5 * 1024 * 1024

/** 400 문구 앞머리 — 캐릭터 밖 항목 (§4.16) */
export const SETTINGS_COMMON_SCOPE = '공통'

/** 캐릭터 순서 — 검사·파일 직렬화가 이 순서를 쓴다. 집합 = CHARACTERS 의 키 (API-T-105) */
export const SETTINGS_CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** AI 모델 키 목록 — 화면 선택지 순서이자 routes zod enum 값 (api.md §5.8.6 · R-SET-013 · R-LLM-009). 집합 = LlmModelKey (API-T-131) */
export const LLM_MODEL_KEYS = ['pro', 'flash'] as const satisfies readonly LlmModelKey[]

/** E16 본문 model 위반 400 문구 (api.md §4.16 · R-SET-005). 입력값을 싣지 않는다 */
export const SETTINGS_MODEL_INVALID_MESSAGE = `${SETTINGS_COMMON_SCOPE} · AI 모델 값이 올바르지 않습니다.`

/** 내보내기 파일 (§16.1). API 페이로드가 아니므로 exportedAt 은 ISO 8601 문자열이다 */
export type CharacterSettingsFile = {
  format: typeof SETTINGS_FILE_FORMAT
  formatVersion: typeof SETTINGS_FILE_FORMAT_VERSION
  exportedAt: string
  settings: CharacterSettings
}

type FieldKey = keyof CharacterSettingFields

/** 값이 string[] 인 필드(sampleDialogue · rules) */
export type ListFieldKey = {
  [K in FieldKey]: CharacterSettingFields[K] extends string[] ? K : never
}[FieldKey]

/** 값이 string 인 필드 */
export type TextFieldKey = Exclude<FieldKey, ListFieldKey>

/** 글 필드. 앞뒤 trim 후 코드 포인트로 센다. required 면 1자 이상 */
export type TextFieldSpec = { kind: 'text'; label: string; required: boolean; max: number }

/** 목록 필드(화면은 "한 줄에 하나"). 항목 trim → 빈 항목 제거 → 개수 · 항목 길이 */
export type ListFieldSpec = { kind: 'list'; label: string; maxItems: number; itemMax: number }

/** 공통 세계관 필드 (R-SET-002). 화면 이름은 '세계관' — 탭 이름은 화면 labels 몫 (api.md §15.12 결정 2) */
export const WORLD_FIELD_SPEC: TextFieldSpec = {
  kind: 'text',
  label: '세계관',
  required: true,
  max: 2000,
}

/** 캐릭터 필드 11개의 화면 이름·필수·상한 (R-SET-002 — s3c-02 §2.1 표 그대로) */
export const CHARACTER_FIELD_SPECS: { readonly [K in TextFieldKey]: TextFieldSpec } & {
  readonly [K in ListFieldKey]: ListFieldSpec
} = {
  sourceMaterial: { kind: 'text', label: '원작·장르', required: false, max: 60 },
  age: { kind: 'text', label: '나이', required: false, max: 40 },
  gender: { kind: 'text', label: '성별', required: false, max: 20 },
  role: { kind: 'text', label: '신분·직업', required: false, max: 80 },
  persona: { kind: 'text', label: '성격·배경', required: true, max: 1500 },
  personalityTags: { kind: 'text', label: '성격 태그', required: false, max: 200 },
  appearance: { kind: 'text', label: '외형', required: false, max: 800 },
  relationships: { kind: 'text', label: '관계 메모', required: false, max: 800 },
  speech: { kind: 'text', label: '말투', required: true, max: 800 },
  sampleDialogue: { kind: 'list', label: '샘플 대사', maxItems: 10, itemMax: 200 },
  rules: { kind: 'list', label: '규칙·금기', maxItems: 20, itemMax: 200 },
}

/** 필드 순서 — 검사·폼·파일 직렬화(화이트리스트)가 이 순서를 쓴다. 집합 = CHARACTER_FIELD_SPECS 의 키 (API-T-105) */
export const CHARACTER_FIELD_KEYS = [
  'sourceMaterial',
  'age',
  'gender',
  'role',
  'persona',
  'personalityTags',
  'appearance',
  'relationships',
  'speech',
  'sampleDialogue',
  'rules',
] as const satisfies readonly FieldKey[]

/** 위반 한 건. path 는 필드 위치(['world'] · ['characters', 'ciel', 'speech']). 객체 단위 위반은 그 객체까지 */
export type SettingsIssue = { path: readonly string[]; message: string }

export type SettingsCheckResult =
  | { ok: true; value: CharacterSettings }
  | { ok: false; issue: SettingsIssue }

/** 400 문구 앞머리: 캐릭터면 shortName, 아니면 '공통' */
export const settingsScopeOf = (id?: CharacterId): string =>
  id === undefined ? SETTINGS_COMMON_SCOPE : CHARACTERS[id].shortName

/** 끝 글자 받침이 있으면 '은', 없으면 '는'. 한글 음절이 아니면 '은(는)' */
const withTopic = (word: string): string => {
  const offset = word.charCodeAt(word.length - 1) - 0xac00
  if (!(offset >= 0 && offset <= 11171)) return `${word}은(는)`
  return `${word}${offset % 28 === 0 ? '는' : '은'}`
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string }
type Failed = { ok: false; issue: SettingsIssue }

const fail = (path: readonly string[], message: string): Failed => ({ ok: false, issue: { path, message } })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasUnknownKey = (obj: Record<string, unknown>, known: readonly string[]): boolean =>
  Object.keys(obj).some(key => !known.includes(key))

const typeMessage = (scope: string, label: string): string =>
  `${scope} · ${label} 값의 형식이 올바르지 않습니다.`

const checkText = (raw: unknown, spec: TextFieldSpec, scope: string): Checked<string> => {
  if (typeof raw !== 'string') return { ok: false, message: typeMessage(scope, spec.label) }
  const value = normalizeText(raw)
  const length = countCodePoints(value)
  if (spec.required && (length < 1 || length > spec.max))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 1~${spec.max}자여야 합니다.` }
  if (length > spec.max)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.max}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkList = (raw: unknown, spec: ListFieldSpec, scope: string): Checked<string[]> => {
  if (!Array.isArray(raw)) return { ok: false, message: typeMessage(scope, spec.label) }
  const items: unknown[] = raw
  if (!items.every((item): item is string => typeof item === 'string'))
    return { ok: false, message: typeMessage(scope, spec.label) }
  const value = items.map(normalizeText).filter(item => item !== '')
  if (value.length > spec.maxItems)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.maxItems}개 이하여야 합니다.` }
  if (value.some(item => countCodePoints(item) > spec.itemMax))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 한 줄에 ${spec.itemMax}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkCharacter = (
  raw: unknown,
  id: CharacterId,
): { ok: true; value: CharacterSettingFields } | Failed => {
  const scope = settingsScopeOf(id)
  const base = ['characters', id]
  if (!isRecord(raw)) return fail(base, `${scope} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(raw, CHARACTER_FIELD_KEYS)) return fail(base, `${scope} · 알 수 없는 항목이 있습니다.`)
  const value: Record<string, string | string[]> = {}
  for (const key of CHARACTER_FIELD_KEYS) {
    const spec = CHARACTER_FIELD_SPECS[key]
    const checked = spec.kind === 'text' ? checkText(raw[key], spec, scope) : checkList(raw[key], spec, scope)
    if (!checked.ok) return fail([...base, key], checked.message)
    value[key] = checked.value
  }
  // 키 집합이 CharacterSettingFields 와 같다는 것은 CHARACTER_FIELD_KEYS 의 satisfies 와 API-T-105 가 보장한다
  return { ok: true, value: value as CharacterSettingFields }
}

/**
 * 저장 전 사전 검사 (R-SET-002 · R-SET-005). 서버 400 과 같은 판정·같은 문구(첫 위반 1건, api.md §4.16 표)
 * 순서: 본체 → 본체의 모르는 키 → world → characters → 모르는 캐릭터 → sebastian → ciel
 * 통과하면 정규화 값(앞뒤 trim · 목록 빈 항목 제거)을 돌려준다. 서버 PUT 응답의 settings 와 같다
 */
export const checkCharacterSettings = (value: unknown): SettingsCheckResult => {
  const common = SETTINGS_COMMON_SCOPE
  if (!isRecord(value)) return fail([], `${common} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(value, ['world', 'characters'])) return fail([], `${common} · 알 수 없는 항목이 있습니다.`)
  const world = checkText(value.world, WORLD_FIELD_SPEC, common)
  if (!world.ok) return fail(['world'], world.message)
  const characters = value.characters
  if (!isRecord(characters)) return fail(['characters'], `${common} · 캐릭터 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(characters, SETTINGS_CHARACTER_IDS))
    return fail(['characters'], `${common} · 알 수 없는 캐릭터가 있습니다.`)
  const sebastian = checkCharacter(characters.sebastian, 'sebastian')
  if (!sebastian.ok) return sebastian
  const ciel = checkCharacter(characters.ciel, 'ciel')
  if (!ciel.ok) return ciel
  return {
    ok: true,
    value: { world: world.value, characters: { sebastian: sebastian.value, ciel: ciel.value } },
  }
}
