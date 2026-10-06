/**
 * [목적] settings 모듈 공개 진입. 갠홈 주인 전용 캐릭터 설정의 저장·조회와 speak·regenerate 용 프롬프트 입력 제공 (R-SET-001~003·005·006·012). 설계 settings.md
 * [공개 API] createSettingsService, characterSettingsSchema, parseCharacterSettings, 타입 SettingsService·SettingsDeps
 * [비동기] D1 1행 읽기·UPSERT 만 await. 캐시 없음
 * [에러] AppError VALIDATION_ERROR(put 재검증 실패). D1 오류는 전파(INTERNAL). OWNER_ONLY 는 auth(requireOwner) 몫
 * [설정] 없음(env 키를 읽지 않는다. 주인 목록은 auth 가 값으로 받는다)
 * [테스트] server/test/settings.test.ts (SRV-T-240~249·259·260)
 */
export { characterSettingsSchema, parseCharacterSettings } from './schema'
export { createSettingsService } from './service'
export type { SettingsDeps, SettingsService } from './service'
