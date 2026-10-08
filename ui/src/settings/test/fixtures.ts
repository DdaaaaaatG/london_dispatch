/**
 * settings 스펙 공용 픽스처 — 단일 소스 ui/src/settings/test/scenarios.md 「공통 전제」
 * - 실제 fetch 없음. api 래퍼는 각 스펙이 vi.mock('@/api/settings') 로 대체하고 이 파일의 Result 값을 돌려준다.
 * - 날짜는 로컬 생성자로 만든다(시간대 무관). 문구는 requirements.md §5 원문 그대로.
 * - 이 파일은 스펙이 아니다(.test 접미사 없음 → vitest 수집 대상 아님).
 */
import type { ApiError, ApiErrorCode, Result } from '@/api'
import type {
  CharacterId,
  CharacterSettingFields,
  CharacterSettings,
  CharacterSettingsResponse,
} from '@shared/types'

export const SEB: CharacterSettingFields = {
  sourceMaterial: '흑집사',
  age: '',
  gender: '',
  role: '집사',
  persona: '팬텀하이브 가의 집사. 계약으로 도련님 곁에 있다.',
  personalityTags: '완벽주의, 냉정',
  appearance: '검은 연미복',
  relationships: '시엘의 집사',
  speech: '정중한 존댓말',
  sampleDialogue: ['예, 도련님.', '팬텀하이브 가의 집사라면 이 정도는.'],
  rules: ['계약을 어기지 않는다'],
}

export const CIEL: CharacterSettingFields = {
  sourceMaterial: '흑집사',
  age: '13',
  gender: '남',
  role: '팬텀하이브 백작',
  persona: '여왕의 번견. 복수를 위해 악마와 계약했다.',
  personalityTags: '오만, 영리',
  appearance: '안대, 푸른 눈',
  relationships: '세바스찬의 주인',
  speech: '짧고 단정한 반말',
  sampleDialogue: ['명령이다.'],
  rules: ['약한 모습을 보이지 않는다'],
}

export const BASE_SETTINGS: CharacterSettings = {
  world: '빅토리아 시대 런던.',
  characters: { sebastian: SEB, ciel: CIEL },
}

/** 저장값 기준 시각 2026-10-06 14:20(로컬) */
export const SAVED_AT = new Date(2026, 9, 6, 14, 20).getTime()

/**
 * (S3f) CharacterSettingsResponse.model 이 필수다(api.md v0.8 §4.15). 기준 픽스처는 'pro'(design.md §2.3 선택 판 캡션 기준값).
 * 세 판 렌더(TC-ST-042)용으로 FLASH_RESPONSE · UNSET_RESPONSE 를 둔다.
 */
export const SAVED_RESPONSE: CharacterSettingsResponse = {
  settings: BASE_SETTINGS,
  version: 3,
  updatedAt: SAVED_AT,
  isDefault: false,
  model: 'pro',
}

/** 시드 상태(isDefault true). 서버 기본 모델이 후보 안이면 model 은 키다(D-ST-14) — TC-ST-048 기준 'pro' */
export const DEFAULT_RESPONSE: CharacterSettingsResponse = {
  settings: BASE_SETTINGS,
  version: 0,
  updatedAt: null,
  isDefault: true,
  model: 'pro',
}

/** (S3f) 지금 쓰는 모델 = Flash */
export const FLASH_RESPONSE: CharacterSettingsResponse = { ...SAVED_RESPONSE, model: 'flash' }

/** (S3f) 미선택 판 — 서버 기본값이 두 후보 밖(model: null, D-ST-14) */
export const UNSET_RESPONSE: CharacterSettingsResponse = { ...SAVED_RESPONSE, model: null }

/** 하단 줄 D clean 문구(SAVED_RESPONSE) */
export const STATUS_SAVED = 'v3 저장됨 10.06 14:20'

/** 확정 문구(requirements.md §5) — 스펙이 문자열을 직접 비교한다 */
export const T = {
  screenTitle: '캐릭터 설정',
  back: '뒤로',
  fileMenu: '설정 파일 메뉴',
  tabList: '설정 묶음',
  tabWorld: '공통', // (S3f v1.1) 「공통 세계관」 → 「공통」(R-SET-009 개정). 탭 id 'world' 는 그대로
  modelLegend: 'AI 모델',
  modelPro: 'Pro',
  modelProDesc: '더 정교하지만 느리고 비용이 큼',
  modelFlash: 'Flash',
  modelFlashDesc: '빠르고 비용이 적음',
  modelNoteSelected: '저장하면 다음 대답부터 이 모델을 씁니다.',
  modelNoteUnset: '아직 고르지 않았습니다. 지금은 서버 기본 모델을 씁니다.',
  tabSeb: '세바스찬',
  tabCiel: '시엘',
  issueSuffix: ', 확인할 항목 있음',
  required: '필수 항목입니다.',
  loading: '설정을 불러오는 중',
  loadError: '설정을 불러오지 못했습니다',
  retry: '다시 시도',
  network: '서버에 연결할 수 없습니다.',
  statusDefault: '기본값 사용 중',
  statusDirty: '저장하지 않은 변경 있음',
  statusSaving: '저장 중...',
  statusStale: '인증 만료',
  revert: '되돌리기',
  save: '저장',
  fileMenuTitle: '설정 파일',
  exportItem: '내보내기',
  importItem: '가져오기',
  cancel: '취소',
  exportTitle: '내보내기',
  exportDirtyNote: '저장하지 않은 변경은 포함되지 않습니다.',
  exportStaleNote: '인증이 만료되어 현재 초안을 내보냅니다.',
  exportText: '내보낼 설정 JSON',
  close: '닫기',
  saveFile: '파일로 저장',
  importTitle: '가져오기',
  chooseFile: '파일 선택',
  noFileChosen: '선택한 파일 없음',
  paste: '또는 JSON 붙여넣기',
  importNote: '초안에만 반영되고 저장은 따로 합니다.',
  importSubmit: '불러오기',
  leaveTitle: '저장하지 않은 변경이 있습니다',
  leaveMessage: '나가면 고친 내용이 사라집니다. 나갈까요?',
  leaveConfirm: '나가기',
  tooLarge: '파일이 5MB를 넘어 읽지 않았습니다.',
  readFailed: '파일을 읽지 못했습니다.',
  unknownFormat: '알 수 없는 파일 형식입니다.',
  unsupportedVersion: '지원하지 않는 파일 버전입니다.',
  noMatchingWorld: '세바스찬·시엘이 들어 있는 세계를 찾지 못했습니다.',
  saved: '저장했습니다. 다음 대사부터 반영됩니다.',
  importNothing: '가져올 항목이 없습니다.',
  fileSaveFailed: '파일로 저장하지 못했습니다. 위 글을 복사해 주세요.',
  staleNotice: '인증이 만료되었습니다. 내보내기로 변경을 보관한 뒤 새로 고쳐 주세요.',
  ownerOnly: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.',
  authTokenRequired: '로그인 정보가 없어 열람 전용으로 바뀌었습니다.',
  authTokenInvalid: '인증이 만료되어 열람 전용으로 바뀌었습니다. 새로 고쳐 주세요.',
  authLevelTooLow: '대화 참여 등급이 아니어서 열람 전용으로 바뀌었습니다.',
} as const

export const ok = <V>(value: V): Result<V> => ({ ok: true, value })

export const fail = <V = never>(code: ApiErrorCode, extra: Partial<ApiError> = {}): Result<V> => ({
  ok: false,
  error: { code, message: 'SERVER-RAW-MESSAGE', ...extra },
})

/** App 통합 스펙의 주인 판정 기본값(비주인). 기존 App 스펙에 그대로 쓸 수 있다 */
export const NOT_OWNER: Result<CharacterSettingsResponse> = fail('OWNER_ONLY')

export type Deferred<V> = { promise: Promise<V>; resolve: (value: V) => void }

export const deferred = <V>(): Deferred<V> => {
  let resolve: (value: V) => void = () => {}
  const promise = new Promise<V>(r => {
    resolve = r
  })
  return { promise, resolve }
}

/** 한 필드만 바꾼 새 설정(입력 불변) */
export const withCharField = <K extends keyof CharacterSettingFields>(
  base: CharacterSettings,
  id: CharacterId,
  key: K,
  value: CharacterSettingFields[K],
): CharacterSettings => ({
  world: base.world,
  characters: { ...base.characters, [id]: { ...base.characters[id], [key]: value } },
})

/** 자체 형식 파일 객체(직렬화 전) */
export const selfFile = (settings: unknown, formatVersion: unknown = 1): Record<string, unknown> => ({
  format: 'london-dispatch/character-settings',
  formatVersion,
  exportedAt: '2026-10-06T05:20:00.000Z',
  settings,
})

/** E.No.S 캐릭터 항목(출처 키 전부 문자열) */
export const enosChar = (name: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  name,
  source_material: '흑집사(E)',
  age: '스물여덟',
  gender: '남(E)',
  job: '집사(E)',
  personality_tags: ['침착', '유능'],
  appearance_desc: '키가 크다',
  hair_style: '흑발',
  eyes: '붉은 눈',
  accessories: '흰 장갑',
  voice: '낮고 부드러운 존댓말(E)',
  sample_dialogue: '예.\n\n  알겠습니다.  ',
  ...extra,
})

/** E.No.S 백업(DB.worlds) — SETTINGS 에 apiKey 를 넣어 둔다(읽지 않아야 한다) */
export const enosBackup = (characters: unknown[], extraWorlds: unknown[] = []): Record<string, unknown> => ({
  SETTINGS: { apiKey: 'sk-SHOULD-NOT-LEAK', API_KEY: 'x', SECRET: 'y' },
  DB: {
    chats: [{ id: 'c1', text: 'SHOULD-NOT-READ' }],
    worlds: [...extraWorlds, { name: '런던', description: '안개 낀 런던(E)', characters }],
  },
})

/** E.No.S world 단독 */
export const enosWorld = (characters: unknown[], description: unknown = '안개 낀 런던(E)'): Record<string, unknown> => ({
  name: '런던',
  description,
  characters,
})

/** 코드 포인트 n 개 문자열 */
export const chars = (n: number, ch = '가'): string => ch.repeat(n)
