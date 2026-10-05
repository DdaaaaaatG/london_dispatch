/**
 * [목적] rooms 테이블 접근 함수(비즈니스 규칙 없음). 행→도메인 변환은 여기서 한 번만 (R-DB-005). 설계 db.md §2.1
 * [공개 API] createRoomsRepo(binding) -> RoomsRepo { listSummaries, exists, touchStmt }
 * [비동기] D1 prepare().bind().all()/first() await. touchStmt 는 실행하지 않고 문장만 돌려준다
 * [에러] D1 오류는 감싸지 않고 전파(onError 가 INTERNAL 로 닫는다)
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-024~027)
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { SQL_ROOMS_EXISTS, SQL_ROOMS_LIST_SUMMARIES, SQL_ROOMS_TOUCH } from './sql'
import type { RoomSummary, RoomSummaryRow } from './types'

export type RoomsRepo = {
  /** 전 방 + 메시지 수, updated_at 내림차순(동률은 id 오름차순) */
  listSummaries: () => Promise<RoomSummary[]>
  /** 방 존재 여부 */
  exists: (id: string) => Promise<boolean>
  /** updated_at 갱신 문장(실행하지 않음). 메시지 쓰기와 같은 batch 에 넣기 위함 */
  touchStmt: (id: string, nowMs: number) => D1PreparedStatement
}

const toRoomSummary = (row: RoomSummaryRow): RoomSummary => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messageCount: row.message_count,
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
})
