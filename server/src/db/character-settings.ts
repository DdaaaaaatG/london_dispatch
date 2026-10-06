/**
 * [목적] character_settings 1행 문서 접근 함수. 읽기·UPSERT 만 하고 JSON 은 해석하지 않는다 (R-SET-003). 설계 db.md §2.5·§3.7
 * [공개 API] createCharacterSettingsRepo(binding) -> CharacterSettingsRepo { get, upsert }, 타입 CharacterSettingsRecord·CharacterSettingsRepo
 * [비동기] D1 prepare().bind().first() await. upsert 는 UPSERT 1문장이라 원자적
 * [에러] D1 오류(테이블 없음·CHECK 위반) 전파. upsert 의 RETURNING 행 없음은 AppError INTERNAL
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-239)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { AppError } from '../app-error'
import { SQL_CHARACTER_SETTINGS_GET, SQL_CHARACTER_SETTINGS_UPSERT } from './sql'
import type { CharacterSettingsRow, CharacterSettingsWriteRow } from './types'

export type CharacterSettingsRecord = {
  /** 설정 본체 JSON 문자열. db 는 해석·검증하지 않는다(재검증은 settings 모듈) */
  json: string
  /** 1 이상. 저장할 때마다 +1 */
  version: number
  /** epoch ms */
  updatedAt: number
}

export type CharacterSettingsRepo = {
  /** id = 1 행. 없으면 null. updated_by 는 읽지 않는다 */
  get: () => Promise<CharacterSettingsRecord | null>
  /** id = 1 행을 만들거나(version 1) 덮어쓴다(version + 1). 갱신 뒤 version·updatedAt 반환 */
  upsert: (
    json: string,
    updatedBy: string,
    nowMs: number,
  ) => Promise<{ version: number; updatedAt: number }>
}

/** character_settings 저장소를 만든다 */
export const createCharacterSettingsRepo = (binding: D1Database): CharacterSettingsRepo => ({
  get: async () => {
    const row = await binding.prepare(SQL_CHARACTER_SETTINGS_GET).first<CharacterSettingsRow>()
    return row === null ? null : { json: row.json, version: row.version, updatedAt: row.updated_at }
  },
  upsert: async (json, updatedBy, nowMs) => {
    const row = await binding
      .prepare(SQL_CHARACTER_SETTINGS_UPSERT)
      .bind(json, nowMs, updatedBy)
      .first<CharacterSettingsWriteRow>()
    if (row === null) throw new AppError('INTERNAL')
    return { version: row.version, updatedAt: row.updated_at }
  },
})
