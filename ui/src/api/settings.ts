import { endpoints } from '@shared/endpoints'
import type {
  CharacterSettings,
  CharacterSettingsResponse,
  LlmModelKey,
  PutCharacterSettingsBody,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.15 · [요구] R-SET-004 · R-SET-010 — 설정 읽기(토큰 필요). 200 = 주인, 403 OWNER_ONLY = 주인 아님 */
export const getCharacterSettings = (): Promise<Result<CharacterSettingsResponse>> =>
  request<CharacterSettingsResponse>(endpoints.characterSettings(), { auth: true })

/**
 * [계약] api.md §4.16 · [요구] R-SET-005 · R-SET-013 — 전체 교체 저장(200). 응답 settings 가 정규화 값, model 이 지금 쓰는 모델 키
 * model 을 주면 함께 저장한다. 생략(undefined)하면 본문에 model 키가 없고 서버 저장값이 유지된다
 */
export const saveCharacterSettings = (
  settings: CharacterSettings,
  model?: LlmModelKey,
): Promise<Result<CharacterSettingsResponse>> => {
  const body: PutCharacterSettingsBody = model === undefined ? { settings } : { settings, model }
  return request<CharacterSettingsResponse>(endpoints.characterSettings(), {
    method: 'PUT',
    body,
    auth: true,
  })
}
