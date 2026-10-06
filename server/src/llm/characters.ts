/**
 * [목적] 캐릭터 설정 JSON 3개(common·sebastian·ciel)를 zod 로 검증해 상수로 만든다(R-LLM-002). 설계 llm.md §2.6·§3.1·§3.2
 * [공개 API] CHARACTER_PROFILES, COMMON_PROMPT, parseCharacterFiles, isCharacterId, CharacterFileError, 타입 CharacterProfile·CommonPrompt
 * [비동기] 없음. 모듈 로드 시 1회 동기 검증(실패하면 Worker 시작이 실패 = 배포 거부)
 * [에러] CharacterFileError(Error) — 메시지는 `파일명: 필드 경로`만, 문구 값 없음. 요청 중에는 나지 않는다
 * [설정] 없음. 표시 메타(avatar·shortName)는 shared 가 단일 소스라 JSON 에 두지 않는다. name 은 shared 표시명과 같아야 한다
 * [테스트] server/test/llm-prompt.test.ts (SRV-T-163~166)
 *
 * // TODO(R-LLM-002): 임시 문구 — 사용자·지인 교체 대기 (server/characters/*.json, 확정사항 §9-3)
 */
import { z } from 'zod'
import { CHARACTERS } from '@shared/characters'
import type { CharacterId } from '@shared/types'
import ciel from '../../characters/ciel.json'
import common from '../../characters/common.json'
import sebastian from '../../characters/sebastian.json'

export type CharacterProfile = {
  readonly id: CharacterId
  readonly name: string
  readonly persona: string
  readonly speech: string
  readonly rules: readonly string[]
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

/** 세 JSON 을 검증한다. 실패 → CharacterFileError. 순수 함수 */
export const parseCharacterFiles = (raw: {
  common: unknown
  sebastian: unknown
  ciel: unknown
}): { common: CommonPrompt; profiles: Readonly<Record<CharacterId, CharacterProfile>> } => ({
  common: parseWith(commonFileSchema, 'common.json', raw.common),
  profiles: {
    sebastian: parseProfile('sebastian', raw.sebastian),
    ciel: parseProfile('ciel', raw.ciel),
  },
})

const loaded = parseCharacterFiles({ common, sebastian, ciel })

/** 모듈 로드 시 1회 검증한 공통 상수 */
export const COMMON_PROMPT: CommonPrompt = loaded.common
/** 모듈 로드 시 1회 검증한 캐릭터 상수 */
export const CHARACTER_PROFILES: Readonly<Record<CharacterId, CharacterProfile>> = loaded.profiles

/** 'sebastian' | 'ciel' 인가 */
export const isCharacterId = (value: unknown): value is CharacterId =>
  value === 'sebastian' || value === 'ciel'
