/**
 * [목적] memory 테이블 접근 함수. S3 은 장기기억 요약 읽기뿐(S4 가 쓰기를 더한다). 설계 db.md §2.3
 * [공개 API] createMemoryRepo(binding) -> MemoryRepo { getSummary }
 * [비동기] D1 prepare().bind().first() await
 * [에러] D1 오류 전파
 * [설정] 없음
 * [테스트] server/test/db.test.ts (SRV-T-190)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { SQL_MEMORY_SUMMARY_BY_ROOM } from './sql'

export type MemoryRepo = {
  /** 방의 memory.summary. memory 행이 없으면 null(빈 문자열 행은 '') */
  getSummary: (roomId: string) => Promise<string | null>
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
})
