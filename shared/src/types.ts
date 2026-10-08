/**
 * 계약 타입 — 단일 소스 doc/200_설계/contract/api.md §5
 * server(routes·서비스)와 ui(api 래퍼·화면)가 함께 import 한다 (R-API-008)
 * 규칙: camelCase · 시각 epoch ms · room id 문자열 · message id 정수 · 없음은 null (R-API-004)
 */
import type { ErrorCode } from './errors'

/** 캐릭터 id. 두 명 고정 (확정사항 §1, R-LLM-002) */
export type CharacterId = 'sebastian' | 'ciel'

/** 메시지 화자 */
export type Speaker = CharacterId | 'user'

/** 메시지 종류. ooc = 유저의 지시 */
export type MessageKind = 'line' | 'ooc'

/** 방 목록 한 줄 — GET /api/rooms (R-ROOM-001) */
export type RoomSummary = {
  id: string
  title: string
  /** epoch ms */
  createdAt: number
  /** epoch ms. 메시지 추가·수정·삭제·재작성 시 갱신 (R-ROOM-005) */
  updatedAt: number
  messageCount: number
}

/** 메시지 한 건 (R-MSG-001). 작성자 로그인 id 는 싣지 않는다 */
export type Message = {
  id: number
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  /** 유저 메시지면 항상 USER_DISPLAY_NAME(「어떠한 의지」 — 서버 투영, R-AUTH-004 S3d). 캐릭터 메시지는 null */
  authorName: string | null
  /** epoch ms */
  createdAt: number
}

/** GET /api/rooms/:id/messages 쿼리. 생략 시 최신부터 30건 */
export type MessagesQuery = {
  /** 이 id 보다 작은(더 오래된) 메시지만. 1 이상 정수 */
  before?: number | undefined
  /** 1~100 정수 */
  limit?: number | undefined
}

/** 히스토리 한 페이지. messages 는 오래된→새 순. 다음 페이지 before = messages[0].id */
export type MessagesPage = {
  messages: Message[]
  hasMore: boolean
}

/** GET /api/health (R-API-005) */
export type HealthResponse = {
  ok: true
  version: string
}

/** POST /api/rooms 본문 (R-ROOM-002). trim·1~60자 판정은 서버 (S2) */
export type CreateRoomBody = {
  title: string
}

/** PATCH /api/rooms/:id 본문 (R-ROOM-003). 규칙은 CreateRoomBody 와 같다 (S2) */
export type RenameRoomBody = {
  title: string
}

/** POST /api/rooms/:id/user 본문 (R-MSG-002). ooc = true 이면 지시(kind 'ooc'). 둘 다 필수 (S2) */
export type UserMessageBody = {
  text: string
  ooc: boolean
}

/** PATCH /api/messages/:id 본문 (R-MSG-004). trim·1~2000자 판정은 서버 (S2) */
export type EditMessageBody = {
  text: string
}

/** speak 대상 (R-MSG-003 · R-MSG-009, v0.6 S3d). 'auto' = 서버가 세바스찬·시엘 중 1명을 고른다. 응답 speaker 는 늘 CharacterId */
export type SpeakTarget = CharacterId | 'auto'

/** POST /api/rooms/:id/speak 본문 (R-MSG-003). 세 값 밖이면 400 VALIDATION_ERROR (S3d) */
export type SpeakBody = {
  character: SpeakTarget
}

/** 캐릭터 1명의 설정 필드 (R-SET-002). id·표시명·아바타는 없다(CHARACTERS 가 단일 소스). 화면 이름·상한은 shared/src/settings.ts */
export type CharacterSettingFields = {
  /** 원작·장르. 선택 */
  sourceMaterial: string
  /** 나이. 선택 */
  age: string
  /** 성별. 선택 */
  gender: string
  /** 신분·직업. 선택 */
  role: string
  /** 성격·배경. 필수 */
  persona: string
  /** 성격 태그. 선택 */
  personalityTags: string
  /** 외형. 선택 */
  appearance: string
  /** 관계 메모. 선택 */
  relationships: string
  /** 말투. 필수 */
  speech: string
  /** 샘플 대사(한 줄에 하나). 빈 배열 허용 */
  sampleDialogue: string[]
  /** 규칙·금기(한 줄에 하나). 빈 배열 허용 */
  rules: string[]
}

/** 캐릭터 설정 본체 — API·D1·내보내기 파일 공통, 전체 교체 단위 (R-SET-002). outputRules 는 없다(편집 불가, R-SET-006) */
export type CharacterSettings = {
  /** 공통 세계관. 필수 */
  world: string
  /** 정확히 두 키(sebastian · ciel) */
  characters: Record<CharacterId, CharacterSettingFields>
}

/** AI 모델 키 (S3f, R-SET-013 · R-LLM-009). 실제 모델명·단가는 server llm/models.ts 에만 있다. 목록·순서는 settings.ts LLM_MODEL_KEYS */
export type LlmModelKey = 'pro' | 'flash'

/** GET · PUT /api/settings/characters 응답 (R-SET-004 · R-SET-005). 저장자 mbId 는 싣지 않는다 (R-AUTH-006) */
export type CharacterSettingsResponse = {
  /** 정규화된 본체(앞뒤 trim · 목록 빈 항목 제거) */
  settings: CharacterSettings
  /** 0 = 시드 사용 중. 저장할 때마다 증가(단조 증가만 약속) */
  version: number
  /** epoch ms. 시드면 null */
  updatedAt: number | null
  /** true = 저장값이 없거나 저장 행이 깨져 시드를 쓰는 중 */
  isDefault: boolean
  /** 지금 실제로 쓰는 모델의 키(api.md §4.15 · R-SET-004 · R-LLM-009). 저장값이 두 키 중 하나면 그 키, 아니면 서버 기본 모델(env LLM_MODEL)과 이름이 같은 키, 그것도 없으면 null */
  model: LlmModelKey | null
}

/** PUT /api/settings/characters 본문 (R-SET-005). settings 안은 strict, 바깥 모르는 키는 버린다 */
export type PutCharacterSettingsBody = {
  settings: CharacterSettings
  /** 고른 모델 키(api.md §4.16 · R-SET-013). 키가 없으면 저장값 유지, null·그 밖의 값은 400. `| undefined` 는 exactOptionalPropertyTypes 에서 zod .optional() 출력과 맞추기 위한 것이고 JSON 에는 나타나지 않는다 */
  model?: LlmModelKey | undefined
}

/** GET · PUT /api/rooms/:id/memory 응답 (R-MEM-001). 행이 없으면 { summary: '', sourceUntilId: 0, updatedAt: null } */
export type MemoryResponse = {
  /** 장기기억 요약. 앞뒤 trim 된 0~4000 코드 포인트(MEMORY_SUMMARY_MAX). 없으면 '' */
  summary: string
  /** 요약에 반영된 마지막 메시지 id(정수 ≥ 0). 0 = 자동 요약 전. PUT 은 바꾸지 않는다 — 단 빈 요약('') 저장이면 0 으로 되돌린다(v0.7.1). 화면은 표시하지 않아도 된다 */
  sourceUntilId: number
  /** epoch ms. 마지막 저장(자동 요약·편집) 시각. 한 번도 저장되지 않았으면 null. 방 updatedAt 과 별개 */
  updatedAt: number | null
}

/** PUT /api/rooms/:id/memory 본문 (R-MEM-001). 모르는 키는 버린다. trim·0~4000자 판정은 서버 */
export type PutMemoryBody = {
  summary: string
}

/** 모든 실패 응답 본문 (R-API-002) */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    /** 429 두 코드에만 붙는다. RATE_LIMITED = 다음 분 창까지, LLM_BUDGET_EXCEEDED = 다음 달 1일 00:00 KST까지 남은 초(정수 ≥ 1). 같은 값이 Retry-After 헤더에도 실린다 (R-AUTH-005 · R-LLM-007) */
    retryAfterSec?: number
  }
}
