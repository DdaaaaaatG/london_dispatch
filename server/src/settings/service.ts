/**
 * [목적] 캐릭터 설정 보관함: D1 1행 문서 읽기·저장·프롬프트 입력 변환(R-SET-003·006, R-LLM-002 개정). 행 없음·재검증 실패면 시드. 설계 settings.md §2.4·§4·§5
 * [공개 API] createSettingsService(deps) -> SettingsService { get, put, loadForPrompt }, 타입 SettingsService·SettingsDeps
 * [비동기] D1 PK 1행 읽기·UPSERT 1문장만 await. 캐시·상태 없음. waitUntil·외부 호출 없음
 * [에러] put 재검증 실패 → AppError VALIDATION_ERROR(400). D1 오류는 시드로 숨기지 않고 전파(→ 500 INTERNAL, N5)
 * [설정] 없음. 주인 판정은 auth(OWNER_MB_IDS)가 한다
 * [테스트] server/test/settings.test.ts (SRV-T-245~249·259·260)
 */
import type { CharacterSettings, CharacterSettingsResponse } from '@shared/types'
import { AppError } from '../app-error'
import type { Principal } from '../auth'
import type { Db } from '../db'
import { DEFAULT_CHARACTER_SETTINGS, toPromptSettings, type PromptSettings } from '../llm'
import type { Logger } from '../logger'
import { parseCharacterSettings } from './schema'

export type SettingsService = {
  /** D1 행 → 재검증 → 응답형. 행 없음·재검증 실패면 시드(isDefault: true, version 0, updatedAt null). D1 throw 는 전파 */
  get: () => Promise<CharacterSettingsResponse>
  /** 입력은 routes 가 zod 로 이미 검증한 값. 정규화 → UPSERT → 응답형 */
  put: (settings: CharacterSettings, by: Principal) => Promise<CharacterSettingsResponse>
  /** speak·regenerate 용. get 과 같은 출처, 프롬프트 입력형으로 */
  loadForPrompt: () => Promise<PromptSettings>
}

export type SettingsDeps = {
  db: Db
  logger: Logger
  now: () => number
}

const SEED_VERSION = 0
const JSON_FIELD = '(json)'
const ROOT_FIELD = '(root)'

const seedResponse = (): CharacterSettingsResponse => ({
  settings: DEFAULT_CHARACTER_SETTINGS,
  version: SEED_VERSION,
  updatedAt: null,
  isDefault: true,
})

const fieldOf = (path: readonly string[]): string =>
  path.length === 0 ? ROOT_FIELD : path.join('.')

const tryParseJson = (json: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(json) as unknown }
  } catch {
    return { ok: false }
  }
}

/** 설정 보관함 서비스를 만든다 */
export const createSettingsService = (deps: SettingsDeps): SettingsService => {
  const { db, logger, now } = deps

  const invalid = (field: string): CharacterSettingsResponse => {
    logger.error('character_settings_invalid', { field })
    return seedResponse()
  }

  /** get·loadForPrompt 의 단일 출처. D1 throw 는 그대로 전파한다 */
  const readCurrent = async (): Promise<CharacterSettingsResponse> => {
    const row = await db.characterSettings.get()
    if (row === null) return seedResponse()
    const parsed = tryParseJson(row.json)
    if (!parsed.ok) return invalid(JSON_FIELD)
    const checked = parseCharacterSettings(parsed.value)
    if (!checked.ok) return invalid(fieldOf(checked.issue.path))
    return {
      settings: checked.value,
      version: row.version,
      updatedAt: row.updatedAt,
      isDefault: false,
    }
  }

  return {
    get: readCurrent,
    put: async (settings, by) => {
      const checked = parseCharacterSettings(settings)
      if (!checked.ok) throw new AppError('VALIDATION_ERROR', checked.issue.message)
      const saved = await db.characterSettings.upsert(JSON.stringify(checked.value), by.mbId, now())
      logger.info('settings_saved', { mbId: by.mbId, version: saved.version })
      return {
        settings: checked.value,
        version: saved.version,
        updatedAt: saved.updatedAt,
        isDefault: false,
      }
    },
    loadForPrompt: async () => toPromptSettings((await readCurrent()).settings),
  }
}
