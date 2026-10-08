/**
 * [목적] rooms 테이블 접근 함수(비즈니스 규칙 없음). 행→도메인 변환은 여기서 한 번만 (R-DB-005). 설계 db.md §2.1
 * [공개 API] createRoomsRepo(binding) -> RoomsRepo { getEntryState(S6), getEntryStateByMessage(S6), setPassHash(S6), listSummaries, exists, touchStmt, insert(S2), updateTitle(S2), deleteCascade(S2), acquireSpeakLock(S3), releaseSpeakLock(S3) }
 * [비동기] D1 prepare().bind().all()/first() await. touchStmt 는 실행하지 않고 문장만 돌려준다. updateTitle·deleteCascade 는 batch(원자적)
 * [에러] D1 오류는 감싸지 않고 전파(onError 가 INTERNAL 로 닫는다)
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-024~027, 121~123, 187~189, 395~399)
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import {
  SQL_MEMORY_DELETE_BY_ROOM,
  SQL_ROOMS_ACQUIRE_SPEAK_LOCK,
  SQL_MESSAGES_DELETE_BY_ROOM,
  SQL_ROOMS_DELETE,
  SQL_ROOMS_ENTRY_STATE,
  SQL_ROOMS_ENTRY_STATE_BY_MESSAGE,
  SQL_ROOMS_EXISTS,
  SQL_ROOMS_INSERT,
  SQL_ROOMS_LIST_SUMMARIES,
  SQL_ROOMS_RELEASE_SPEAK_LOCK,
  SQL_ROOMS_SET_PASS_HASH,
  SQL_ROOMS_SUMMARY_BY_ID,
  SQL_ROOMS_TOUCH,
  SQL_ROOMS_UPDATE_TITLE,
  SQL_ROOMS_WAS_LOCKED,
} from './sql'
import type { RoomEntryRow, RoomSummary, RoomSummaryRow } from './types'

/** S6. 입장 판정용 상태. passHash 는 rooms 모듈 전용 — 응답·로그에 싣지 않는다 */
export type RoomEntryState = { roomId: string; passHash: string | null }

/** 선점 결과. missing = 방 없음 */
export type SpeakLockResult = 'acquired' | 'busy' | 'missing'

export type RoomsRepo = {
  /** 전 방 + 메시지 수, updated_at 내림차순(동률은 id 오름차순) */
  listSummaries: () => Promise<RoomSummary[]>
  /** 방 존재 여부 */
  exists: (id: string) => Promise<boolean>
  /** updated_at 갱신 문장(실행하지 않음). 메시지 쓰기와 같은 batch 에 넣기 위함 */
  touchStmt: (id: string, nowMs: number) => D1PreparedStatement
  /** S2. created_at = updated_at = nowMs, speaking_until NULL. S6: 넷째 바인딩 pass_hash(생략 = NULL) */
  insert: (room: {
    id: string
    title: string
    nowMs: number
    passHash?: string | null
  }) => Promise<void>
  /** S2. 제목만 변경(updated_at 유지) + 요약 재조회를 한 batch 로. 방이 없으면 null */
  updateTitle: (id: string, title: string) => Promise<RoomSummary | null>
  /** S2. memory → messages → rooms 순서 DELETE 를 한 batch 로. 방이 없었으면 false */
  deleteCascade: (id: string) => Promise<boolean>
  /** S3. speaking_until 이 NULL 이거나 만료(≤ nowMs)일 때만 untilMs 로 선점 + 방 존재 확인을 한 batch 로 */
  acquireSpeakLock: (id: string, untilMs: number, nowMs: number) => Promise<SpeakLockResult>
  /** S3. 내가 건 잠금(speaking_until = untilMs)일 때만 NULL 로. 지웠으면 true */
  releaseSpeakLock: (id: string, untilMs: number) => Promise<boolean>
  /** S6. 방 PK 1행 → { roomId, passHash }. 방이 없으면 null */
  getEntryState: (roomId: string) => Promise<RoomEntryState | null>
  /** S6. 메시지 PK → 방 JOIN 1문장. 메시지가 없으면 null */
  getEntryStateByMessage: (messageId: number) => Promise<RoomEntryState | null>
  /** S6. batch[이전 상태 SELECT, UPDATE pass_hash, 요약 SELECT]. 방이 없으면 null. updated_at 은 건드리지 않는다 */
  setPassHash: (
    roomId: string,
    passHash: string | null,
  ) => Promise<{ room: RoomSummary; wasLocked: boolean } | null>
}

const toEntryState = (row: RoomEntryRow | null): RoomEntryState | null =>
  row === null ? null : { roomId: row.room_id, passHash: row.pass_hash }

const toRoomSummary = (row: RoomSummaryRow): RoomSummary => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messageCount: row.message_count,
  locked: row.locked === 1,
})

/** rooms 저장소를 만든다 */
export const createRoomsRepo = (binding: D1Database): RoomsRepo => ({
  listSummaries: async () => {
    const result = await binding.prepare(SQL_ROOMS_LIST_SUMMARIES).all<RoomSummaryRow>()
    return result.results.map(toRoomSummary)
  },
  exists: async id => {
    const row = await binding.prepare(SQL_ROOMS_EXISTS).bind(id).first<{ found: number }>()
    return row !== null
  },
  touchStmt: (id, nowMs) => binding.prepare(SQL_ROOMS_TOUCH).bind(nowMs, id),
  insert: async ({ id, title, nowMs, passHash }) => {
    await binding
      .prepare(SQL_ROOMS_INSERT)
      .bind(id, title, nowMs, passHash ?? null)
      .run()
  },
  updateTitle: async (id, title) => {
    const results = await binding.batch<RoomSummaryRow>([
      binding.prepare(SQL_ROOMS_UPDATE_TITLE).bind(title, id),
      binding.prepare(SQL_ROOMS_SUMMARY_BY_ID).bind(id),
    ])
    const row = results[1]?.results[0]
    return row === undefined ? null : toRoomSummary(row)
  },
  deleteCascade: async id => {
    const results = await binding.batch([
      binding.prepare(SQL_MEMORY_DELETE_BY_ROOM).bind(id),
      binding.prepare(SQL_MESSAGES_DELETE_BY_ROOM).bind(id),
      binding.prepare(SQL_ROOMS_DELETE).bind(id),
    ])
    return (results[2]?.meta.changes ?? 0) > 0
  },
  acquireSpeakLock: async (id, untilMs, nowMs) => {
    const results = await binding.batch<{ id: string }>([
      binding.prepare(SQL_ROOMS_ACQUIRE_SPEAK_LOCK).bind(untilMs, id, nowMs),
      binding.prepare(SQL_ROOMS_EXISTS).bind(id),
    ])
    if ((results[0]?.results.length ?? 0) > 0) return 'acquired'
    return (results[1]?.results.length ?? 0) > 0 ? 'busy' : 'missing'
  },
  releaseSpeakLock: async (id, untilMs) => {
    const result = await binding.prepare(SQL_ROOMS_RELEASE_SPEAK_LOCK).bind(id, untilMs).run()
    return result.meta.changes > 0
  },
  getEntryState: async roomId =>
    toEntryState(await binding.prepare(SQL_ROOMS_ENTRY_STATE).bind(roomId).first<RoomEntryRow>()),
  getEntryStateByMessage: async messageId =>
    toEntryState(
      await binding.prepare(SQL_ROOMS_ENTRY_STATE_BY_MESSAGE).bind(messageId).first<RoomEntryRow>(),
    ),
  setPassHash: async (roomId, passHash) => {
    const results = await binding.batch<RoomSummaryRow & { was_locked: number }>([
      binding.prepare(SQL_ROOMS_WAS_LOCKED).bind(roomId),
      binding.prepare(SQL_ROOMS_SET_PASS_HASH).bind(passHash, roomId),
      binding.prepare(SQL_ROOMS_SUMMARY_BY_ID).bind(roomId),
    ])
    const row = results[2]?.results[0]
    if (row === undefined) return null
    return { room: toRoomSummary(row), wasLocked: results[0]?.results[0]?.was_locked === 1 }
  },
})
