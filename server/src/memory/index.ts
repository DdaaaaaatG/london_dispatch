/**
 * [목적] memory 모듈 공개 진입. 장기기억 조회·편집(R-MEM-001)과 speak 뒤 자동 요약(R-MEM-002·003). 설계 memory.md
 * [공개 API] createMemoryService(get·put·summarizeIfNeeded), planSummary·pendingCountCap·capByChars·fitSummary, SUMMARY_BATCH_MAX·SUMMARY_INPUT_CHARS_MAX·SUMMARY_CUT_MIN, 타입 MemoryService·MemoryDeps·MemoryState·PutMemoryInput·SummarizeOutcome·SummarizeStage
 * [비동기] 모든 서비스 함수 async. summarizeIfNeeded 는 throw 하지 않는다
 * [에러] get·put: VALIDATION_ERROR·NOT_FOUND(D1 장애는 전파). summarizeIfNeeded: 없음(SummarizeOutcome 으로 반환)
 * [설정] 없음. contextMessages·summaryThreshold·llm thunk 를 컨테이너가 값으로 전달
 * [테스트] server/test/memory.test.ts (SRV-T-296~315), app.test.ts (SRV-T-327)
 */
export {
  createMemoryService,
  type MemoryDeps,
  type MemoryService,
  type MemoryState,
  type PutMemoryInput,
  type SummarizeOutcome,
  type SummarizeStage,
} from './service'
export {
  capByChars,
  fitSummary,
  pendingCountCap,
  planSummary,
  SUMMARY_BATCH_MAX,
  SUMMARY_CUT_MIN,
  SUMMARY_INPUT_CHARS_MAX,
} from './summarize'
