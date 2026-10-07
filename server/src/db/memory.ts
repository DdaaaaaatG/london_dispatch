/**
 * [목적] memory 테이블 접근 함수. S3 요약 읽기 + S4 상태 읽기·편집 저장·낙관적 잠금 전진(R-MEM-001·002·003). 설계 db.md §2.3·§13
 * [공개 API] createMemoryRepo(binding) -> MemoryRepo { getSummary, getState(S4), putSummary(S4), advance(S4) }, 타입 MemoryRecord·MemorySnapshot
 * [비동기] D1 prepare().bind().first() await. advance·putSummary 는 문장 1개(원자적)
 * [에러] D1 오류 전파(CHECK 위반 포함). 숫자 좁히기 실패 → AppError INTERNAL
 * [설정] 없음. 판정(기준·길이·trim)은 서비스 몫, 시각은 nowMs 로 받는다
 * [테스트] server/test/db.test.ts (SRV-T-190, 322~324, 331)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { AppError } from '../app-error'
import {
  SQL_MEMORY_ADVANCE,
  SQL_MEMORY_PUT_SUMMARY,
  SQL_MEMORY_STATE_BY_ROOM,
  SQL_MEMORY_SUMMARY_BY_ROOM,
} from './sql'

/** memory 행 1개(도메인). updatedAt 은 epoch ms */
export type MemoryRecord = { summary: string; sourceUntilId: number; updatedAt: number }
/** advance 의 새 값·기대값 */
export type MemorySnapshot = { summary: string; sourceUntilId: number }

type MemoryRow = { summary: string; source_until_id: number; updated_at: number }

export type MemoryRepo = {
  /** S3. 방의 memory.summary. 행이 없으면 null (speak·regenerate 경로, 그대로) */
  getSummary: (roomId: string) => Promise<string | null>
  /** S4. 행 전체. 없으면 null */
  getState: (roomId: string) => Promise<MemoryRecord | null>
  /** S4. summary·updated_at 교체(UPSERT). source_until_id 유지, 단 summary 가 ''이면 0 으로 리셋(새 행은 0). 방이 없으면 null */
  putSummary: (roomId: string, summary: string, nowMs: number) => Promise<MemoryRecord | null>
  /** S4. 행이 없으면 next 로 넣고, 있으면 expected 와 같을 때만 next 로 바꾼다. 바꿨으면 true. 불일치·방 없음 → false */
  advance: (
    roomId: string,
    next: MemorySnapshot,
    expected: MemorySnapshot,
    nowMs: number,
  ) => Promise<boolean>
}

const BAD_DATA_MESSAGE = '저장된 데이터 형식이 올바르지 않습니다.'

const toRecord = (row: MemoryRow | null): MemoryRecord | null => {
  if (row === null) return null
  if (
    typeof row.summary !== 'string' ||
    typeof row.source_until_id !== 'number' ||
    typeof row.updated_at !== 'number'
  ) {
    throw new AppError('INTERNAL', BAD_DATA_MESSAGE)
  }
  return { summary: row.summary, sourceUntilId: row.source_until_id, updatedAt: row.updated_at }
}

/** memory 저장소를 만든다 */
export const createMemoryRepo = (binding: D1Database): MemoryRepo => ({
  getSummary: async roomId => {
    const row = await binding
      .prepare(SQL_MEMORY_SUMMARY_BY_ROOM)
      .bind(roomId)
      .first<{ summary: string }>()
    return row === null ? null : row.summary
  },
  getState: async roomId =>
    toRecord(await binding.prepare(SQL_MEMORY_STATE_BY_ROOM).bind(roomId).first<MemoryRow>()),
  putSummary: async (roomId, summary, nowMs) =>
    toRecord(
      await binding.prepare(SQL_MEMORY_PUT_SUMMARY).bind(roomId, summary, nowMs).first<MemoryRow>(),
    ),
  advance: async (roomId, next, expected, nowMs) => {
    const row = await binding
      .prepare(SQL_MEMORY_ADVANCE)
      .bind(
        roomId,
        next.summary,
        next.sourceUntilId,
        nowMs,
        expected.sourceUntilId,
        expected.summary,
      )
      .first<{ room_id: string }>()
    return row !== null
  },
})
