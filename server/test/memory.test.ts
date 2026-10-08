// SRV-T-296~315 — doc/200_설계/server/memory.md §8.1 (장기기억 서비스·순수 함수). workers pool D1 + FakeProvider + 가짜 시계·수집 로거
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countCodePoints } from '@shared/limits'
import { AppError } from '../src/app-error'
import { createDb, type Db } from '../src/db'
import { ConfigError } from '../src/env'
import {
  createLlm,
  createUsageMeter,
  FakeProvider,
  kstMonthKey,
  type FakeStep,
  type Llm,
} from '../src/llm'
import { LlmError } from '../src/llm/provider'
import { createLogger } from '../src/logger'
import {
  capByChars,
  createMemoryService,
  fitSummary,
  pendingCountCap,
  planSummary,
  SUMMARY_CUT_MIN,
  type MemoryService,
  type SummarizeOutcome,
} from '../src/memory'
import { insertRoom, insertUsage, resetDb } from './helpers'

const T0 = 1_000_000
const ROOM = 'a'

type Log = { level: string; event: string; [k: string]: unknown }

type Setup = {
  svc: MemoryService
  db: Db
  fake: FakeProvider
  logs: Log[]
  clock: { t: number }
}

type SetupOptions = {
  wrapDb?: (db: Db) => Db
  llm?: () => Llm | Promise<Llm>
  meter?: boolean
  timeoutMs?: number
}

const setup = (steps: FakeStep[] = [], opts: SetupOptions = {}): Setup => {
  const clock = { t: T0 }
  const now = (): number => clock.t
  const logs: Log[] = []
  const logger = createLogger((_level, line) => {
    logs.push(JSON.parse(line) as Log)
  })
  const fake = new FakeProvider(steps)
  const base = createDb(env.DB)
  const db = opts.wrapDb === undefined ? base : opts.wrapDb(base)
  const llm =
    opts.llm ??
    ((): Llm =>
      createLlm({
        provider: fake,
        timeoutMs: opts.timeoutMs ?? 60_000,
        logger,
        now,
        sleep: async ms => {
          clock.t += ms
        },
        ...(opts.meter === true
          ? {
              meter: createUsageMeter({
                store: db.llmUsage,
                config: {
                  monthlyBudgetKrw: 100,
                  priceInputUsdPerM: 0.3,
                  priceOutputUsdPerM: 2.5,
                  krwPerUsd: 1400,
                },
                logger,
                now,
              }),
            }
          : {}),
      }))
  const svc = createMemoryService({
    db,
    now,
    logger,
    contextMessages: 40,
    summaryThreshold: 60,
    llm: () => Promise.resolve(llm()),
  })
  return { svc, db, fake, logs, clock }
}

/** 본문 `본문#001#` 형식의 캐릭터 메시지 n 개(오래된 → 새)를 넣고 id 배열을 돌려준다. 본문 길이를 늘릴 수 있다 */
const seed = async (n: number, pad = 0, roomId = ROOM): Promise<number[]> => {
  const ids: number[] = []
  for (let i = 1; i <= n; i += 1) {
    const text = `본문#${String(i).padStart(3, '0')}#${'가'.repeat(pad)}`
    const row = await env.DB.prepare(
      "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES (?1, 'sebastian', 'line', ?2, ?3) RETURNING id",
    )
      .bind(roomId, text, i)
      .first<{ id: number }>()
    ids.push(row?.id ?? -1)
  }
  return ids
}

const tag = (i: number): string => `본문#${String(i).padStart(3, '0')}#`

type MemRow = { summary: string; source_until_id: number; updated_at: number }
const memRow = async (roomId = ROOM): Promise<MemRow | null> =>
  env.DB.prepare('SELECT summary, source_until_id, updated_at FROM memory WHERE room_id = ?1')
    .bind(roomId)
    .first<MemRow>()
const insertMemory = async (summary: string, source: number): Promise<void> => {
  await env.DB.prepare(
    'INSERT INTO memory (room_id, summary, source_until_id, updated_at) VALUES (?1, ?2, ?3, 5)',
  )
    .bind(ROOM, summary, source)
    .run()
}
const roomUpdatedAt = async (): Promise<number> =>
  (
    await env.DB.prepare('SELECT updated_at AS u FROM rooms WHERE id = ?1')
      .bind(ROOM)
      .first<{ u: number }>()
  )?.u ?? -1

const userTurn = (fake: FakeProvider, n = 0): string => fake.calls[n]?.turns[0]?.text ?? ''
const events = (logs: Log[]): string[] => logs.map(l => l.event)

/** 해제 전까지 응답을 미루는 각본 */
const gated = (text: string): { step: FakeStep; release: () => void } => {
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  return {
    step: async () => {
      await gate
      return { text }
    },
    release,
  }
}

const rowsOf = (n: number, textOf: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => ({
    speaker: 'ciel' as const,
    kind: 'line' as const,
    text: textOf(i),
  }))

beforeEach(async () => {
  await resetDb()
  await insertRoom(ROOM, 'A', 1, 100)
})

describe('순수 함수 (R-MEM-002)', () => {
  it('SRV-T-296 planSummary_and_pendingCountCap_vectors', () => {
    expect(planSummary(60, 60, 40)).toBe(0)
    expect(planSummary(61, 60, 40)).toBe(21)
    expect(planSummary(80, 60, 40)).toBe(40)
    expect(planSummary(250, 60, 40)).toBe(100)
    expect(planSummary(42, 41, 40)).toBe(2)
    expect(pendingCountCap(60, 40)).toBe(141)
    expect(pendingCountCap(1000, 40)).toBe(1001)
  })

  it('SRV-T-297 capByChars_prefix_by_code_points', () => {
    expect(capByChars(rowsOf(15, () => 'x'.repeat(2000)))).toHaveLength(10)
    expect(capByChars(rowsOf(5, () => 'x'.repeat(10)))).toHaveLength(5)
    expect(capByChars(rowsOf(3, () => 'x'.repeat(25_000)))).toHaveLength(1)
    expect(
      capByChars(
        rowsOf(3, () => '😀'.repeat(10)),
        20,
      ),
    ).toHaveLength(2)
  })

  it('SRV-T-298 fitSummary_cuts_at_boundary_or_max', () => {
    const exact = 'a'.repeat(4000)
    expect(fitSummary(exact)).toEqual({ text: exact, truncated: false })

    const withNewline = 'a'.repeat(3500) + '\n' + 'b'.repeat(500)
    expect(withNewline).toHaveLength(4001)
    const cut = fitSummary(withNewline)
    expect(cut.truncated).toBe(true)
    expect(cut.text).toBe('a'.repeat(3500))

    const sentence = 'a'.repeat(3499) + '.' + 'b'.repeat(501)
    expect(fitSummary(sentence)).toEqual({ text: 'a'.repeat(3499) + '.', truncated: true })

    const early = 'a'.repeat(2000) + '.' + 'b'.repeat(2000)
    expect(early).toHaveLength(4001)
    const hard = fitSummary(early)
    expect(hard.truncated).toBe(true)
    expect(countCodePoints(hard.text)).toBe(4000)
    expect(SUMMARY_CUT_MIN).toBe(3000)

    const emoji = fitSummary('😀'.repeat(4001))
    expect(emoji.truncated).toBe(true)
    expect(countCodePoints(emoji.text)).toBe(4000)
    for (const r of [cut, hard, emoji]) expect(countCodePoints(r.text)).toBeLessThanOrEqual(4000)
  })
})

describe('summarizeIfNeeded 구간·기준 (R-MEM-002)', () => {
  it('SRV-T-299 below_threshold_skips_without_llm_or_log', async () => {
    await seed(60)
    const s = setup()
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({
      status: 'skipped',
      reason: 'below_threshold',
    })
    expect(s.fake.calls).toHaveLength(0)
    expect(await memRow()).toBeNull()
    expect(s.logs).toHaveLength(0)
  })

  it('SRV-T-300 first_summary_covers_oldest_21_only', async () => {
    const ids = await seed(61)
    const s = setup([{ text: '  첫 요약  ' }])
    const out = await s.svc.summarizeIfNeeded(ROOM)
    expect(out).toEqual({ status: 'summarized', untilId: ids[20], messages: 21, truncated: false })
    const turn = userTurn(s.fake)
    for (let i = 1; i <= 21; i += 1) expect(turn).toContain(tag(i))
    for (let i = 22; i <= 61; i += 1) expect(turn).not.toContain(tag(i))
    expect(turn).not.toContain('[지난 이야기 요약]')
    expect(await memRow()).toEqual({ summary: '첫 요약', source_until_id: ids[20], updated_at: T0 })
  })

  it('SRV-T-301 continues_from_source_until_id_with_previous_summary', async () => {
    const ids = await seed(80)
    await insertMemory('지난 요약', ids[9] ?? 0)
    const s = setup([{ text: '합본 요약' }])
    const out = await s.svc.summarizeIfNeeded(ROOM)
    expect(out).toEqual({ status: 'summarized', untilId: ids[39], messages: 30, truncated: false })
    const turn = userTurn(s.fake)
    expect(turn).toContain('[지난 이야기 요약] 지난 요약')
    for (let i = 1; i <= 10; i += 1) expect(turn).not.toContain(tag(i))
    for (let i = 11; i <= 40; i += 1) expect(turn).toContain(tag(i))
    expect(turn).not.toContain(tag(41))
    expect(await memRow()).toMatchObject({ summary: '합본 요약', source_until_id: ids[39] })
  })

  it('SRV-T-302 batch_cap_100_and_followup_calls', async () => {
    const ids = await seed(250)
    const s = setup()
    const first = await s.svc.summarizeIfNeeded(ROOM)
    expect(first).toMatchObject({ status: 'summarized', untilId: ids[99], messages: 100 })
    const second = await s.svc.summarizeIfNeeded(ROOM)
    expect(second).toMatchObject({ status: 'summarized', untilId: ids[199], messages: 100 })
    const third = await s.svc.summarizeIfNeeded(ROOM)
    expect(third).toEqual({ status: 'skipped', reason: 'below_threshold' })
    expect(s.fake.calls).toHaveLength(2)
  })

  it('SRV-T-303 input_chars_cap_shrinks_batch', async () => {
    const ids = await seed(61, 1993)
    const s = setup()
    const out = await s.svc.summarizeIfNeeded(ROOM)
    expect(out).toMatchObject({ status: 'summarized', messages: 10, untilId: ids[9] })
    expect((await memRow())?.source_until_id).toBe(ids[9])
  })
})

describe('동시성 (R-MEM-003)', () => {
  it('SRV-T-304 concurrent_summaries_only_first_wins', async () => {
    const ids = await seed(61)
    const g0 = gated('먼저 끝남')
    const g1 = gated('나중에 끝남')
    const s = setup([g0.step, g1.step])
    const p0 = s.svc.summarizeIfNeeded(ROOM)
    const p1 = s.svc.summarizeIfNeeded(ROOM)
    await vi.waitFor(() => expect(s.fake.calls).toHaveLength(2))
    g0.release()
    await vi.waitFor(async () => expect(await memRow()).not.toBeNull())
    g1.release()
    const outcomes = (await Promise.all([p0, p1])).map(o => o.status).sort()
    expect(outcomes).toEqual(['conflict', 'summarized'])
    expect(await memRow()).toMatchObject({ summary: '먼저 끝남', source_until_id: ids[20] })
    expect(s.fake.calls).toHaveLength(2)
    expect(events(s.logs).filter(e => e === 'memory_summary_conflict')).toHaveLength(1)
  })

  it('SRV-T-305 put_during_summary_wins_and_next_summary_builds_on_edit', async () => {
    const ids = await seed(61)
    let svc: MemoryService | null = null
    const s = setup([
      async () => {
        await svc?.put(ROOM, { summary: '사람이 고침' })
        return { text: '자동 요약' }
      },
    ])
    svc = s.svc
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({ status: 'conflict' })
    expect(await memRow()).toMatchObject({ summary: '사람이 고침', source_until_id: 0 })
    const again = await s.svc.summarizeIfNeeded(ROOM)
    expect(again).toMatchObject({ status: 'summarized', untilId: ids[20] })
    expect(userTurn(s.fake, 1)).toContain('[지난 이야기 요약] 사람이 고침')
    expect(userTurn(s.fake, 1)).toContain(tag(1))
  })

  it('SRV-T-306 room_deleted_during_summary_is_conflict_without_orphan', async () => {
    await seed(61)
    const s = setup([
      async () => {
        await createDb(env.DB).rooms.deleteCascade(ROOM)
        return { text: '요약' }
      },
    ])
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({ status: 'conflict' })
    expect(await memRow()).toBeNull()
  })
})

describe('실패·예산 (R-MEM-002·R-LLM-007)', () => {
  it('SRV-T-307 llm_failures_are_swallowed_and_logged', async () => {
    await seed(61)
    const cases: { steps: FakeStep[]; code: string }[] = [
      {
        steps: [{ error: new LlmError('http_5xx') }, { error: new LlmError('http_5xx') }],
        code: 'LLM_FAILED',
      },
      { steps: [{ error: new LlmError('http_4xx') }], code: 'LLM_FAILED' },
      { steps: [{ error: new LlmError('blocked') }], code: 'LLM_EMPTY' },
      { steps: [{ text: '   ' }], code: 'LLM_EMPTY' },
    ]
    for (const c of cases) {
      const s = setup(c.steps)
      const out = await s.svc.summarizeIfNeeded(ROOM)
      expect(out).toEqual({ status: 'failed', stage: 'llm', code: c.code })
      expect(await memRow()).toBeNull()
      const warn = s.logs.find(l => l.event === 'memory_summary_failed')
      expect(warn).toMatchObject({ level: 'warn', roomId: ROOM, stage: 'llm', code: c.code })
    }
  })

  it('SRV-T-308 budget_exceeded_skips_before_llm_call', async () => {
    await seed(61)
    await insertUsage(kstMonthKey(T0), 100)
    const s = setup([], { meter: true })
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({ status: 'skipped', reason: 'budget' })
    expect(s.fake.calls).toHaveLength(0)
    expect(s.logs.find(l => l.event === 'memory_summary_skipped')).toMatchObject({
      level: 'info',
      roomId: ROOM,
      reason: 'budget',
    })
    expect(await memRow()).toBeNull()
  })

  it('SRV-T-309 d1_failures_map_to_read_and_write_stage', async () => {
    await seed(61)
    const boom = async (): Promise<never> => {
      throw new Error('d1 down')
    }
    const readFail = setup([], {
      wrapDb: db => ({ ...db, memory: { ...db.memory, getState: boom } }),
    })
    expect(await readFail.svc.summarizeIfNeeded(ROOM)).toEqual({
      status: 'failed',
      stage: 'read',
      code: 'INTERNAL',
    })
    const writeFail = setup([], {
      wrapDb: db => ({ ...db, memory: { ...db.memory, advance: boom } }),
    })
    expect(await writeFail.svc.summarizeIfNeeded(ROOM)).toEqual({
      status: 'failed',
      stage: 'write',
      code: 'INTERNAL',
    })
    expect(events(writeFail.logs)).toContain('memory_summary_failed')
    expect(await memRow()).toBeNull()
  })

  it('SRV-T-310 overlong_output_is_cut_at_line_boundary', async () => {
    await seed(61)
    const raw = 'a'.repeat(3600) + '\n' + 'b'.repeat(899)
    expect(raw).toHaveLength(4500)
    const s = setup([{ text: raw }])
    const out: SummarizeOutcome = await s.svc.summarizeIfNeeded(ROOM)
    expect(out).toMatchObject({ status: 'summarized', truncated: true })
    expect((await memRow())?.summary).toBe('a'.repeat(3600))
    expect(s.logs.find(l => l.event === 'memory_summarized')).toMatchObject({
      truncated: true,
      outChars: 3600,
    })
  })

  it('SRV-T-311 summary_call_uses_25s_budget_and_never_retries_after_it', async () => {
    await seed(61)
    const ok = setup([{ text: '정상' }])
    await ok.svc.summarizeIfNeeded(ROOM)
    expect(ok.fake.calls.map(c => c.timeoutMs)).toEqual([25_000])

    await env.DB.prepare('DELETE FROM memory').run()
    const holder: { s: Setup | null } = { s: null }
    const timeout = setup([
      async () => {
        if (holder.s !== null) holder.s.clock.t += 25_000
        throw new LlmError('timeout')
      },
    ])
    holder.s = timeout
    const out = await timeout.svc.summarizeIfNeeded(ROOM)
    expect(out).toEqual({ status: 'failed', stage: 'llm', code: 'LLM_FAILED' })
    expect(timeout.fake.calls).toHaveLength(1)
  })

  it('SRV-T-312 logs_never_contain_summary_or_message_bodies', async () => {
    await seed(80)
    await insertMemory('기존요약_SECRET_Q1', 3)
    await env.DB.prepare("UPDATE messages SET text = text || '_SECRET_Q2'").run()
    const s = setup([{ text: '모델출력_SECRET_Q3' }])
    expect(await s.svc.summarizeIfNeeded(ROOM)).toMatchObject({ status: 'summarized' })
    const all = JSON.stringify(s.logs)
    for (const secret of ['SECRET_Q1', 'SECRET_Q2', 'SECRET_Q3', '본문#']) {
      expect(all).not.toContain(secret)
    }
    const done = s.logs.find(l => l.event === 'memory_summarized')
    expect(Object.keys(done ?? {}).sort()).toEqual(
      [
        'level',
        'event',
        'roomId',
        'fromId',
        'untilId',
        'messages',
        'inChars',
        'outChars',
        'truncated',
        'ms',
      ].sort(),
    )
  })

  it('SRV-T-315 missing_llm_key_is_failed_at_budget_stage', async () => {
    await seed(61)
    const s = setup([], {
      llm: () => {
        throw new ConfigError(['LLM_API_KEY'])
      },
    })
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({
      status: 'failed',
      stage: 'budget',
      code: 'CONFIG_INVALID',
    })
    expect(await memRow()).toBeNull()
  })
})

describe('get·put (R-MEM-001)', () => {
  it('SRV-T-313 get_default_row_or_not_found', async () => {
    const s = setup()
    expect(await s.svc.get(ROOM)).toEqual({ summary: '', sourceUntilId: 0, updatedAt: null })
    await insertMemory('요약', 9)
    expect(await s.svc.get(ROOM)).toEqual({ summary: '요약', sourceUntilId: 9, updatedAt: 5 })
    await expect(s.svc.get('zzz')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('SRV-T-314 put_validates_trims_and_keeps_source_until_id', async () => {
    const trap = new Proxy(
      {},
      {
        get: () => {
          throw new Error('db touched')
        },
      },
    ) as unknown as Db
    const guard = setup([], { wrapDb: () => trap })
    for (const bad of [{ summary: 'x'.repeat(4001) }, { summary: 1 }, { summary: null }]) {
      const err = await guard.svc.put(ROOM, bad as unknown as { summary: string }).catch(e => e)
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe('VALIDATION_ERROR')
      expect((err as AppError).message).toBe('장기기억은 0~4000자로 입력해 주세요.')
    }

    const s = setup()
    const before = await roomUpdatedAt()
    // 행 없음 → 생성(source 0), trim
    expect(await s.svc.put(ROOM, { summary: '  a  ' })).toEqual({
      summary: 'a',
      sourceUntilId: 0,
      updatedAt: T0,
    })
    // 빈 요약 허용
    expect((await s.svc.put(ROOM, { summary: '' })).summary).toBe('')
    // 이모지 4000개 허용, 4001개 거절
    const emoji = '😀'.repeat(4000)
    expect((await s.svc.put(ROOM, { summary: emoji })).summary).toBe(emoji)
    await expect(s.svc.put(ROOM, { summary: emoji + '😀' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    // source_until_id 유지
    await env.DB.prepare('UPDATE memory SET source_until_id = 7 WHERE room_id = ?1')
      .bind(ROOM)
      .run()
    expect(await s.svc.put(ROOM, { summary: '중간\n줄바꿈' })).toMatchObject({
      summary: '중간\n줄바꿈',
      sourceUntilId: 7,
    })
    // 방 없음
    await expect(s.svc.put('zzz', { summary: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await memRow('zzz')).toBeNull()
    expect(await roomUpdatedAt()).toBe(before)
  })

  it('SRV-T-332 put_empty_resets_source_until_id_and_next_summary_restarts_from_first', async () => {
    const ids = await seed(61)
    await insertMemory('지난 요약', ids[20] ?? 0)
    const s = setup([{ text: '새 요약' }])
    // 공백만도 trim 후 빈 요약 → 리셋
    expect(await s.svc.put(ROOM, { summary: '   ' })).toEqual({
      summary: '',
      sourceUntilId: 0,
      updatedAt: T0,
    })
    expect(await s.svc.get(ROOM)).toMatchObject({ summary: '', sourceUntilId: 0 })
    const out = await s.svc.summarizeIfNeeded(ROOM)
    expect(out).toEqual({ status: 'summarized', untilId: ids[20], messages: 21, truncated: false })
    const turn = userTurn(s.fake)
    expect(turn).not.toContain('[지난 이야기 요약]')
    for (let i = 1; i <= 21; i += 1) expect(turn).toContain(tag(i))
    expect(await memRow()).toMatchObject({ summary: '새 요약', source_until_id: ids[20] })
  })

  it('SRV-T-333 put_non_empty_edit_keeps_source_until_id', async () => {
    const ids = await seed(5)
    await insertMemory('지난 요약', ids[3] ?? 0)
    const s = setup()
    expect(await s.svc.put(ROOM, { summary: '편집본' })).toMatchObject({
      summary: '편집본',
      sourceUntilId: ids[3],
    })
  })
})

describe('S3f 공장 D1 오류 (memory.md §12)', () => {
  it('SRV-T-356 factory_rejection_is_failed_budget_and_not_called_below_threshold', async () => {
    await seed(61)
    const llm = vi.fn(async (): Promise<Llm> => {
      throw new Error('d1 down')
    })
    const s = setup([], { llm })
    expect(await s.svc.summarizeIfNeeded(ROOM)).toEqual({
      status: 'failed',
      stage: 'budget',
      code: 'INTERNAL',
    })
    expect(
      s.logs.filter(l => l.level === 'warn' && l.event === 'memory_summary_failed'),
    ).toHaveLength(1)
    expect(await memRow()).toBeNull()
    expect(llm).toHaveBeenCalledTimes(1)

    await resetDb()
    await insertRoom(ROOM, 'A', 1, 100)
    await seed(3)
    const idle = vi.fn(async (): Promise<Llm> => {
      throw new Error('d1 down')
    })
    const t = setup([], { llm: idle })
    expect((await t.svc.summarizeIfNeeded(ROOM)).status).toBe('skipped')
    expect(idle).not.toHaveBeenCalled()
  })
})
