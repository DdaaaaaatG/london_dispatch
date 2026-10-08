/**
 * [목적] 캐릭터 설정 보관함: D1 1행 문서 읽기·저장·프롬프트 입력 변환(R-SET-003·006, R-LLM-002 개정). 행 없음·재검증 실패면 시드. 설계 settings.md §2.4·§4·§5
 * [공개 API] createSettingsService(deps) -> SettingsService { get, put, loadForPrompt, loadModelKey(S3f) }, 타입 SettingsService·SettingsDeps
 * [비동기] D1 PK 1행 읽기·UPSERT 1문장만 await. 캐시·상태 없음. waitUntil·외부 호출 없음
 * [에러] put 재검증 실패 → AppError VALIDATION_ERROR(400). D1 오류는 시드로 숨기지 않고 전파(→ 500 INTERNAL, N5)
 * [설정] fallbackModelKey 를 컨테이너가 값으로 받는다(modelKeyOf(config.llmModel)). 주인 판정은 auth(OWNER_MB_IDS)가 한다
 * [테스트] server/test/settings.test.ts (SRV-T-245~249·259·260, 342~346)
 */
import { LLM_MODEL_KEYS } from '@shared/settings'
import type { CharacterSettings, CharacterSettingsResponse, LlmModelKey } from '@shared/types'
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
  put: (
    settings: CharacterSettings,
    by: Principal,
    model?: LlmModelKey,
  ) => Promise<CharacterSettingsResponse>
  /** speak·regenerate 용. get 과 같은 출처, 프롬프트 입력형으로 */
  loadForPrompt: () => Promise<PromptSettings>
  /** S3f. 저장된 모델 키. 없음·NULL → null, 표 밖 값 → null + error 로그 llm_model_invalid {}. D1 오류는 전파 */
  loadModelKey: () => Promise<LlmModelKey | null>
}

export type SettingsDeps = {
  db: Db
  logger: Logger
  now: () => number
  /** S3f. 저장값이 없을 때 응답 model = env 모델의 키(modelKeyOf(config.llmModel)), 두 후보 밖이면 null */
  fallbackModelKey: LlmModelKey | null
}

const SEED_VERSION = 0
const JSON_FIELD = '(json)'
const ROOT_FIELD = '(root)'

/** model 을 뺀 응답 + 모델 칸 원값. model 은 get·put 이 effectiveKey 로 채운다(loadForPrompt 는 모델을 판정하지 않는다) */
type Current = Omit<CharacterSettingsResponse, 'model'> & { rawModel: string | null }

const seedCurrent = (rawModel: string | null): Current => ({
  settings: DEFAULT_CHARACTER_SETTINGS,
  version: SEED_VERSION,
  updatedAt: null,
  isDefault: true,
  rawModel,
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

  /** 칸 원값 → 키. 표 밖이면 값을 남기지 않고 error 로그 1건 후 null */
  const toModelKey = (raw: string | null): LlmModelKey | null => {
    if (raw === null) return null
    const key = LLM_MODEL_KEYS.find(k => k === raw)
    if (key !== undefined) return key
    logger.error('llm_model_invalid', {})
    return null
  }
  const effectiveKey = (raw: string | null): LlmModelKey | null =>
    toModelKey(raw) ?? deps.fallbackModelKey

  const invalid = (field: string, rawModel: string | null): Current => {
    logger.error('character_settings_invalid', { field })
    return seedCurrent(rawModel)
  }

  /** get·loadForPrompt 의 단일 출처. D1 throw 는 그대로 전파한다 */
  const readCurrent = async (): Promise<Current> => {
    const row = await db.characterSettings.get()
    if (row === null) return seedCurrent(null)
    // 본체가 훼손돼 시드로 대체해도 model 은 칸 기준(D-SET-12)
    const parsed = tryParseJson(row.json)
    if (!parsed.ok) return invalid(JSON_FIELD, row.llmModel)
    const checked = parseCharacterSettings(parsed.value)
    if (!checked.ok) return invalid(fieldOf(checked.issue.path), row.llmModel)
    return {
      settings: checked.value,
      version: row.version,
      updatedAt: row.updatedAt,
      isDefault: false,
      rawModel: row.llmModel,
    }
  }

  return {
    get: async () => {
      const { rawModel, ...rest } = await readCurrent()
      return { ...rest, model: effectiveKey(rawModel) }
    },
    put: async (settings, by, model) => {
      const checked = parseCharacterSettings(settings)
      if (!checked.ok) throw new AppError('VALIDATION_ERROR', checked.issue.message)
      const saved = await db.characterSettings.upsert(
        JSON.stringify(checked.value),
        by.mbId,
        now(),
        model ?? null,
      )
      const effective = effectiveKey(saved.llmModel)
      logger.info('settings_saved', { mbId: by.mbId, version: saved.version, model: effective })
      return {
        settings: checked.value,
        version: saved.version,
        updatedAt: saved.updatedAt,
        isDefault: false,
        model: effective,
      }
    },
    loadForPrompt: async () => toPromptSettings((await readCurrent()).settings),
    loadModelKey: async () => toModelKey(await db.characterSettings.getModel()),
  }
}
