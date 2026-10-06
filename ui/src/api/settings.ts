import { endpoints } from '@shared/endpoints'
import type {
  CharacterSettings,
  CharacterSettingsResponse,
  PutCharacterSettingsBody,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.15 · [요구] R-SET-004 · R-SET-010 — 설정 읽기(토큰 필요). 200 = 주인, 403 OWNER_ONLY = 주인 아님 */
export const getCharacterSettings = (): Promise<Result<CharacterSettingsResponse>> =>
  request<CharacterSettingsResponse>(endpoints.characterSettings(), { auth: true })

/** [계약] api.md §4.16 · [요구] R-SET-005 — 전체 교체 저장(200). 응답 settings 가 정규화 값이다 */
export const saveCharacterSettings = (
  settings: CharacterSettings,
): Promise<Result<CharacterSettingsResponse>> => {
  const body: PutCharacterSettingsBody = { settings }
  return request<CharacterSettingsResponse>(endpoints.characterSettings(), {
    method: 'PUT',
    body,
    auth: true,
  })
}
