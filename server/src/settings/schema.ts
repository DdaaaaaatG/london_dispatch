/**
 * [목적] 캐릭터 설정 본체 zod 스키마와 라우트 밖 검증(R-SET-002·005, N1~N4). 통과/실패 판정만 하고 한국어 문구는 shared checkCharacterSettings 가 만든다. 설계 settings.md §2.2·§2.3
 * [공개 API] characterSettingsSchema(zod, 출력 = 정규화된 CharacterSettings), parseCharacterSettings(raw) -> SettingsCheckResult
 * [비동기] 없음. 순수 함수
 * [에러] throw 없음. 실패는 { ok: false, issue }
 * [설정] 없음. 상한·필수는 @shared/settings 의 WORLD_FIELD_SPEC·CHARACTER_FIELD_SPECS 에서 읽는다(숫자 리터럴 중복 금지)
 * [테스트] server/test/settings.test.ts (SRV-T-240~244)
 */
import { ERROR_MESSAGES } from '@shared/errors'
import { countCodePoints, normalizeText } from '@shared/limits'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  SETTINGS_CHARACTER_IDS,
  WORLD_FIELD_SPEC,
  checkCharacterSettings,
  type ListFieldSpec,
  type SettingsCheckResult,
  type TextFieldSpec,
} from '@shared/settings'
import type { CharacterSettings } from '@shared/types'
import { z } from 'zod'

/** 길이는 코드 포인트로 센다(zod .max() 는 UTF-16 단위라 쓰지 않는다). 정규화 = trim */
const textField = (spec: TextFieldSpec) =>
  z
    .string()
    .transform(normalizeText)
    .refine(v => {
      const n = countCodePoints(v)
      return n <= spec.max && (!spec.required || n >= 1)
    })

/** 항목마다 trim → 빈 항목 제거 → 개수 → 항목 길이 */
const listField = (spec: ListFieldSpec) =>
  z
    .array(z.string())
    .transform(items => items.map(normalizeText).filter(item => item !== ''))
    .refine(
      items =>
        items.length <= spec.maxItems && items.every(item => countCodePoints(item) <= spec.itemMax),
    )

const fieldSchema = (key: (typeof CHARACTER_FIELD_KEYS)[number]) => {
  const spec = CHARACTER_FIELD_SPECS[key]
  return spec.kind === 'text' ? textField(spec) : listField(spec)
}

const characterShape = Object.fromEntries(CHARACTER_FIELD_KEYS.map(key => [key, fieldSchema(key)]))
const charactersShape = Object.fromEntries(
  SETTINGS_CHARACTER_IDS.map(id => [id, z.strictObject(characterShape)]),
)

/**
 * 설정 본체 스키마 — 정의 1곳(routes 의 putCharacterSettingsBody 가 재사용). strict 3단, 두 캐릭터·11필드 키 전부 필수.
 * 출력 타입은 shared CharacterSettings 로 고정한다(키 집합 일치는 SRV-T-240 이 단언)
 */
export const characterSettingsSchema = z.strictObject({
  world: textField(WORLD_FIELD_SPEC),
  characters: z.strictObject(charactersShape),
}) as unknown as z.ZodType<CharacterSettings, unknown>

/**
 * 라우트 밖 검증(서비스 put·D1 행 재검증). zod 와 shared 검사가 둘 다 통과해야 ok, 값은 shared 정규화 값(N4).
 * shared 가 실패면 그 첫 위반, zod 만 실패하면 기본 문구(안전망)
 */
export const parseCharacterSettings = (raw: unknown): SettingsCheckResult => {
  const shared = checkCharacterSettings(raw)
  if (!shared.ok) return shared
  if (!characterSettingsSchema.safeParse(raw).success) {
    return { ok: false, issue: { path: [], message: ERROR_MESSAGES.VALIDATION_ERROR } }
  }
  return shared
}
