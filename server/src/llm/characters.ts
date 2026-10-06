/**
 * [목적] 캐릭터 설정 JSON 3개(common·sebastian·ciel)를 zod 로 검증해 상수로 만든다(R-LLM-002). 설계 llm.md §2.6·§3.1·§3.2
 * [공개 API] CHARACTER_PROFILES, COMMON_PROMPT, parseCharacterFiles, isCharacterId, CharacterFileError, S3c: DEFAULT_CHARACTER_SETTINGS·OUTPUT_RULES·toPromptSettings·DEFAULT_PROMPT_SETTINGS, 타입 CharacterProfile·CommonPrompt·PromptSettings
 * [S3c] JSON 파일은 시드로 강등(R-LLM-002 개정). 형식 불변. 시드는 설정 본체 형태로 만들어 shared checkCharacterSettings 로 상한 검사. 설계 llm.md §3.4
 * [비동기] 없음. 모듈 로드 시 1회 동기 검증(실패하면 Worker 시작이 실패 = 배포 거부)
 * [에러] CharacterFileError(Error) — 메시지는 `파일명: 필드 경로`만, 문구 값 없음. 요청 중에는 나지 않는다
 * [설정] 없음. 표시 메타(avatar·shortName)는 shared 가 단일 소스라 JSON 에 두지 않는다. name 은 shared 표시명과 같아야 한다
 * [테스트] server/test/llm-prompt.test.ts (SRV-T-163~166, 250·251)
 *
 * // TODO(R-LLM-002): 임시 문구 — 사용자·지인 교체 대기 (server/characters/*.json, 확정사항 §9-3)
 */
import { z } from 'zod'
import { CHARACTERS } from '@shared/characters'
import { checkCharacterSettings } from '@shared/settings'
import type { CharacterId, CharacterSettings } from '@shared/types'
import ciel from '../../characters/ciel.json'
import common from '../../characters/common.json'
import sebastian from '../../characters/sebastian.json'

export type CharacterProfile = {
  readonly id: CharacterId
  readonly name: string
  readonly persona: string
  readonly speech: string
  readonly rules: readonly string[]
  /** S3c 신규 8필드 — 선택. 없음·''·[] 이면 프롬프트에서 생략 */
  readonly sourceMaterial?: string
  readonly age?: string
  readonly gender?: string
  readonly role?: string
  readonly personalityTags?: string
  readonly appearance?: string
  readonly relationships?: string
  readonly sampleDialogue?: readonly string[]
}
export type CommonPrompt = { readonly world: string; readonly outputRules: readonly string[] }

/** 캐릭터 JSON 형식 오류. 파일명·필드 경로만 담는다 */
export class CharacterFileError extends Error {
  constructor(file: string, field: string) {
    super(`${file}: ${field}`)
    this.name = 'CharacterFileError'
  }
}

const text = z.string().trim().min(1)
const characterFileSchema = z.strictObject({
  id: z.enum(['sebastian', 'ciel']),
  name: text,
  persona: text,
  speech: text,
  rules: z.array(text),
})
const commonFileSchema = z.strictObject({
  world: text,
  outputRules: z.array(text).min(1),
})

/** 첫 이슈의 필드 경로. 모르는 키는 그 키 이름 */
const fieldOf = (issue: z.core.$ZodIssue): string => {
  if (issue.code === 'unrecognized_keys') return issue.keys[0] ?? '(unknown)'
  return issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)'
}

const parseWith = <T>(schema: z.ZodType<T>, file: string, raw: unknown): T => {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new CharacterFileError(file, issue === undefined ? '(root)' : fieldOf(issue))
  }
  return parsed.data
}

const parseProfile = (slot: CharacterId, raw: unknown): CharacterProfile => {
  const file = `${slot}.json`
  const data = parseWith(characterFileSchema, file, raw)
  if (data.id !== slot) throw new CharacterFileError(file, 'id')
  if (data.name !== CHARACTERS[slot].name) throw new CharacterFileError(file, 'name')
  return data
}

/** S3c. 프롬프트 조립 입력. settings.loadForPrompt 반환형 = buildSpeakPrompt 의 둘째·셋째 인자 */
export type PromptSettings = {
  profiles: Readonly<Record<CharacterId, CharacterProfile>>
  common: CommonPrompt
}

const seedFields = (p: CharacterProfile): CharacterSettings['characters'][CharacterId] => ({
  sourceMaterial: '',
  age: '',
  gender: '',
  role: '',
  persona: p.persona,
  personalityTags: '',
  appearance: '',
  relationships: '',
  speech: p.speech,
  sampleDialogue: [],
  rules: [...p.rules],
})

const toSeedSettings = (
  common: CommonPrompt,
  profiles: Readonly<Record<CharacterId, CharacterProfile>>,
): CharacterSettings => ({
  world: common.world,
  characters: { sebastian: seedFields(profiles.sebastian), ciel: seedFields(profiles.ciel) },
})

/** shared issue.path → (파일명, 필드). 문구(message)는 쓰지 않는다 */
const seedIssueLocation = (path: readonly string[]): { file: string; field: string } => {
  const [head, id, key] = path
  if (head === 'world') return { file: 'common.json', field: 'world' }
  if (head === 'characters' && (id === 'sebastian' || id === 'ciel')) {
    return { file: `${id}.json`, field: key ?? '(root)' }
  }
  return { file: 'common.json', field: '(root)' }
}

/** 세 JSON 을 검증한다(스키마 → 시드 상한 검사). 실패 → CharacterFileError. 순수 함수 */
export const parseCharacterFiles = (raw: {
  common: unknown
  sebastian: unknown
  ciel: unknown
}): { common: CommonPrompt; profiles: Readonly<Record<CharacterId, CharacterProfile>> } => {
  const common = parseWith(commonFileSchema, 'common.json', raw.common)
  const profiles = {
    sebastian: parseProfile('sebastian', raw.sebastian),
    ciel: parseProfile('ciel', raw.ciel),
  }
  const checked = checkCharacterSettings(toSeedSettings(common, profiles))
  if (!checked.ok) {
    const { file, field } = seedIssueLocation(checked.issue.path)
    throw new CharacterFileError(file, field)
  }
  return { common, profiles }
}

const loaded = parseCharacterFiles({ common, sebastian, ciel })

/** 모듈 로드 시 1회 검증한 공통 상수 */
export const COMMON_PROMPT: CommonPrompt = loaded.common
/** 모듈 로드 시 1회 검증한 캐릭터 상수 */
export const CHARACTER_PROFILES: Readonly<Record<CharacterId, CharacterProfile>> = loaded.profiles

/** 'sebastian' | 'ciel' 인가 */
export const isCharacterId = (value: unknown): value is CharacterId =>
  value === 'sebastian' || value === 'ciel'

/** S3c. 시드 = 세 JSON 을 설정 본체 형태로. 신규 필드는 '' · []. 모듈 로드 시 1회 */
export const DEFAULT_CHARACTER_SETTINGS: CharacterSettings = toSeedSettings(
  COMMON_PROMPT,
  CHARACTER_PROFILES,
)

/** S3c. 출력 규칙 — 시드 common.json 에만 있다(편집 불가, R-SET-006) */
export const OUTPUT_RULES: readonly string[] = COMMON_PROMPT.outputRules

/** S3c. 설정 본체 → 프롬프트 입력. id = 키, name = 표시명, outputRules = OUTPUT_RULES. 값 복사만(검증 없음) */
export const toPromptSettings = (settings: CharacterSettings): PromptSettings => {
  const profileOf = (id: CharacterId): CharacterProfile => ({
    id,
    name: CHARACTERS[id].name,
    ...settings.characters[id],
  })
  return {
    profiles: { sebastian: profileOf('sebastian'), ciel: profileOf('ciel') },
    common: { world: settings.world, outputRules: OUTPUT_RULES },
  }
}

/** S3c. = toPromptSettings(DEFAULT_CHARACTER_SETTINGS). messages 의 loadPromptSettings 기본값 */
export const DEFAULT_PROMPT_SETTINGS: PromptSettings = toPromptSettings(DEFAULT_CHARACTER_SETTINGS)
