// SRV-T-020~031 — doc/200_설계/server/db.md §8
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createDb } from '../src/db'
import { toSpeaker } from '../src/db/types'
import { insertLine, insertLines, insertRoom, resetDb } from './helpers'

type Col = { name: string; type: string; notnull: number; pk: number }

const columns = async (table: string): Promise<[string, string, number, number][]> => {
  const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all<Col>()
  return r.results.map(c => [c.name, c.type, c.notnull, c.pk])
}

beforeEach(resetDb)

describe('schema', () => {
  it('SRV-T-020 migration_creates_four_tables_with_columns', async () => {
    expect(await columns('rooms')).toEqual([
      ['id', 'TEXT', 0, 1],
      ['title', 'TEXT', 1, 0],
      ['created_at', 'INTEGER', 1, 0],
      ['updated_at', 'INTEGER', 1, 0],
      ['speaking_until', 'INTEGER', 0, 0],
    ])
    expect(await columns('messages')).toEqual([
      ['id', 'INTEGER', 0, 1],
      ['room_id', 'TEXT', 1, 0],
      ['speaker', 'TEXT', 1, 0],
      ['kind', 'TEXT', 1, 0],
      ['text', 'TEXT', 1, 0],
      ['author_mb_id', 'TEXT', 0, 0],
      ['author_name', 'TEXT', 0, 0],
      ['created_at', 'INTEGER', 1, 0],
    ])
    expect(await columns('memory')).toEqual([
      ['room_id', 'TEXT', 0, 1],
      ['summary', 'TEXT', 1, 0],
      ['source_until_id', 'INTEGER', 1, 0],
      ['updated_at', 'INTEGER', 1, 0],
    ])
    expect(await columns('rate_limits')).toEqual([
      ['mb_id', 'TEXT', 1, 1],
      ['window_start', 'INTEGER', 1, 2],
      ['count', 'INTEGER', 1, 0],
    ])
  })

  it('SRV-T-021 migration_check_constraints_reject_invalid_rows', async () => {
    await insertRoom('r1', 'room', 1, 1)
    const bad: [string, string, unknown[]][] = [
      [
        'speaker bob',
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('r1','bob','line','x',1)",
        [],
      ],
      [
        'kind x',
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('r1','ciel','x','x',1)",
        [],
      ],
      [
        'character ooc',
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('r1','ciel','ooc','x',1)",
        [],
      ],
      [
        'empty text',
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('r1','ciel','line','',1)",
        [],
      ],
      [
        'empty title',
        "INSERT INTO rooms (id, title, created_at, updated_at) VALUES ('r2','',1,1)",
        [],
      ],
      [
        '61 title',
        'INSERT INTO rooms (id, title, created_at, updated_at) VALUES (?1, ?2, 1, 1)',
        ['r3', 'a'.repeat(61)],
      ],
      [
        'user without author',
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('r1','user','line','x',1)",
        [],
      ],
      [
        'summary 4001',
        'INSERT INTO memory (room_id, summary, source_until_id, updated_at) VALUES (?1, ?2, 0, 1)',
        ['r1', 'a'.repeat(4001)],
      ],
      ['count 0', "INSERT INTO rate_limits (mb_id, window_start, count) VALUES ('m',0,0)", []],
    ]
    for (const [label, sql, params] of bad) {
      await expect(
        env.DB.prepare(sql)
          .bind(...params)
          .run(),
        label,
      ).rejects.toThrow()
    }
  })

  it('SRV-T-022 migration_creates_required_indexes', async () => {
    const list = await env.DB.prepare('PRAGMA index_list(messages)').all<{ name: string }>()
    expect(list.results.map(r => r.name)).toContain('idx_messages_room_id_id')
    const rooms = await env.DB.prepare('PRAGMA index_list(rooms)').all<{ name: string }>()
    expect(rooms.results.map(r => r.name)).toContain('idx_rooms_updated_at')
    const info = await env.DB.prepare('PRAGMA index_info(idx_messages_room_id_id)').all<{
      seqno: number
      name: string
    }>()
    expect(info.results.sort((a, b) => a.seqno - b.seqno).map(r => r.name)).toEqual([
      'room_id',
      'id',
    ])
  })

  it('SRV-T-023 foreign_key_rejects_message_for_unknown_room', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES ('nope','ciel','line','x',1)",
      ).run(),
    ).rejects.toThrow()
    await insertRoom('r1', 'room', 1, 1)
    await insertLine('r1', 'hi')
    await expect(env.DB.prepare("DELETE FROM rooms WHERE id = 'r1'").run()).rejects.toThrow()
  })
})

describe('rooms repo', () => {
  it('SRV-T-024 listSummaries_returns_empty_array_when_no_rooms', async () => {
    expect(await createDb(env.DB).rooms.listSummaries()).toEqual([])
  })

  it('SRV-T-025 listSummaries_orders_by_updatedAt_desc_with_counts', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 300)
    await insertRoom('c', 'C', 1, 200)
    await insertRoom('d', 'D', 1, 200)
    await insertLines('b', 2)
    await insertLines('c', 5)
    const list = await createDb(env.DB).rooms.listSummaries()
    expect(list.map(r => r.id)).toEqual(['b', 'c', 'd', 'a'])
    expect(list.map(r => r.messageCount)).toEqual([2, 5, 0, 0])
  })

  it('SRV-T-026 exists_returns_true_only_for_existing_room', async () => {
    await insertRoom('a', 'A', 1, 1)
    const db = createDb(env.DB)
    expect(await db.rooms.exists('a')).toBe(true)
    expect(await db.rooms.exists('zzz')).toBe(false)
  })

  it('SRV-T-027 touchStmt_updates_updated_at_and_reports_zero_changes_for_unknown', async () => {
    await insertRoom('a', 'A', 1, 1)
    const db = createDb(env.DB)
    const ok = await db.rooms.touchStmt('a', 999).run()
    expect(ok.meta.changes).toBe(1)
    const row = await env.DB.prepare("SELECT updated_at FROM rooms WHERE id = 'a'").first<{
      updated_at: number
    }>()
    expect(row?.updated_at).toBe(999)
    const none = await db.rooms.touchStmt('zzz', 5).run()
    expect(none.meta.changes).toBe(0)
  })
})

describe('messages repo', () => {
  it('SRV-T-028 pageDesc_returns_desc_rows_before_cursor_within_room', async () => {
    await insertRoom('a', 'A', 1, 1)
    await insertRoom('b', 'B', 1, 1)
    const ids: number[] = []
    for (let i = 0; i < 4; i += 1) {
      ids.push(await insertLine('a', `a${i}`, i))
      await insertLine('b', `b${i}`, i)
    }
    const db = createDb(env.DB)
    const latest = await db.messages.pageDesc('a', 3)
    expect(latest.map(m => m.id)).toEqual([ids[3], ids[2], ids[1]])
    const before = await db.messages.pageDesc('a', 10, ids[2])
    expect(before.map(m => m.id)).toEqual([ids[1], ids[0]])
    expect(before.every(m => m.roomId === 'a')).toBe(true)
  })

  it('SRV-T-029 pageDesc_maps_row_to_camelCase_without_author_mb_id', async () => {
    await insertRoom('a', 'A', 1, 1)
    await insertLine('a', 'hi', 7)
    const [m] = await createDb(env.DB).messages.pageDesc('a', 1)
    expect(Object.keys(m!).sort()).toEqual([
      'authorName',
      'createdAt',
      'id',
      'kind',
      'roomId',
      'speaker',
      'text',
    ])
    expect(m!.authorName).toBeNull()
    expect(m!.createdAt).toBe(7)
  })
})

describe('batch·좁히기', () => {
  it('SRV-T-030 batch_rolls_back_all_when_one_statement_fails', async () => {
    const db = createDb(env.DB)
    await expect(
      db.batch([
        env.DB.prepare(
          "INSERT INTO rooms (id, title, created_at, updated_at) VALUES ('ok','t',1,1)",
        ),
        env.DB.prepare(
          "INSERT INTO rooms (id, title, created_at, updated_at) VALUES ('bad','',1,1)",
        ),
      ]),
    ).rejects.toThrow()
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM rooms').first<{ n: number }>()
    expect(count?.n).toBe(0)
  })

  it('SRV-T-031 narrowing_throws_INTERNAL_on_unexpected_speaker', () => {
    expect(() => toSpeaker('bob')).toThrow(AppError)
    try {
      toSpeaker('bob')
    } catch (e) {
      expect((e as AppError).code).toBe('INTERNAL')
    }
  })
})

// ---- S2 (SRV-T-121~128) — doc/200_설계/server/db.md §8 ----
const NOW2 = 1_800_000_000_000

const roomRow = async (id: string) =>
  env.DB.prepare('SELECT title, created_at, updated_at, speaking_until FROM rooms WHERE id = ?1')
    .bind(id)
    .first<{
      title: string
      created_at: number
      updated_at: number
      speaking_until: number | null
    }>()

const countWhere = async (table: string, where: string, ...binds: unknown[]): Promise<number> =>
  (
    await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
      .bind(...binds)
      .first<{ n: number }>()
  )?.n ?? -1

const newUserMessage = (roomId: string, text = 'hi') => ({
  roomId,
  speaker: 'user' as const,
  kind: 'line' as const,
  text,
  authorMbId: 'mb_a',
  authorName: '닉',
})

describe('rooms repo S2', () => {
  it('SRV-T-121 rooms_insert_sets_created_and_updated_at_equal', async () => {
    const db = createDb(env.DB)
    await db.rooms.insert({ id: 'r1', title: '방', nowMs: NOW2 })
    expect(await roomRow('r1')).toEqual({
      title: '방',
      created_at: NOW2,
      updated_at: NOW2,
      speaking_until: null,
    })
    await expect(db.rooms.insert({ id: 'r1', title: '방', nowMs: NOW2 })).rejects.toThrow()
  })

  it('SRV-T-122 rooms_updateTitle_returns_summary_or_null_and_keeps_updated_at', async () => {
    const db = createDb(env.DB)
    await insertRoom('r1', '옛 제목', 5, 100)
    await insertRoom('r2', '다른 방', 5, 200)
    await insertLines('r1', 2)
    expect(await db.rooms.updateTitle('r1', '새 제목')).toEqual({
      id: 'r1',
      title: '새 제목',
      createdAt: 5,
      updatedAt: 100,
      messageCount: 2,
    })
    expect(await db.rooms.updateTitle('nope', 'x')).toBeNull()
    expect((await roomRow('r2'))?.title).toBe('다른 방')
  })

  it('SRV-T-123 rooms_deleteCascade_removes_children_then_room', async () => {
    const db = createDb(env.DB)
    await insertRoom('a', 'A', 1, 1)
    await insertRoom('b', 'B', 1, 1)
    await insertLines('a', 3)
    await insertLines('b', 2)
    await env.DB.prepare(
      "INSERT INTO memory (room_id, summary, source_until_id, updated_at) VALUES ('a', 's', 1, 1)",
    ).run()
    expect(await db.rooms.deleteCascade('a')).toBe(true)
    expect(await countWhere('rooms', 'id = ?1', 'a')).toBe(0)
    expect(await countWhere('messages', 'room_id = ?1', 'a')).toBe(0)
    expect(await countWhere('memory', 'room_id = ?1', 'a')).toBe(0)
    expect(await countWhere('messages', 'room_id = ?1', 'b')).toBe(2)
    expect(await countWhere('messages', 'room_id NOT IN (SELECT id FROM rooms)')).toBe(0)
    expect(await db.rooms.deleteCascade('nope')).toBe(false)
  })
})

describe('messages repo S2', () => {
  it('SRV-T-124 messages_insert_returns_row_and_touches_room_or_null', async () => {
    const db = createDb(env.DB)
    await insertRoom('r1', 'R', 1, 100)
    const saved = await db.messages.insert(newUserMessage('r1'), NOW2)
    expect(Object.keys(saved ?? {}).sort()).toEqual(
      ['authorName', 'createdAt', 'id', 'kind', 'roomId', 'speaker', 'text'].sort(),
    )
    expect(saved).toMatchObject({ roomId: 'r1', speaker: 'user', kind: 'line', createdAt: NOW2 })
    expect(
      (
        await env.DB.prepare('SELECT author_mb_id FROM messages WHERE id = ?1')
          .bind(saved?.id ?? 0)
          .first<{ author_mb_id: string }>()
      )?.author_mb_id,
    ).toBe('mb_a')
    expect((await roomRow('r1'))?.updated_at).toBe(NOW2)

    expect(await db.messages.insert(newUserMessage('nope'), NOW2)).toBeNull()
    expect(await countWhere('messages', "room_id = 'nope'")).toBe(0)

    await insertRoom('r2', 'R2', 1, 100)
    await expect(
      db.messages.insert({ ...newUserMessage('r2'), authorMbId: null, authorName: null }, NOW2),
    ).rejects.toThrow()
    expect((await roomRow('r2'))?.updated_at).toBe(100)
  })

  it('SRV-T-125 messages_updateText_returns_row_and_touches_owning_room', async () => {
    const db = createDb(env.DB)
    await insertRoom('r1', 'R', 1, 100)
    await insertRoom('r2', 'R2', 1, 100)
    const [id] = await insertLines('r1', 1)
    const updated = await db.messages.updateText(id ?? 0, '고침', NOW2)
    expect(updated).toMatchObject({ id, text: '고침', speaker: 'sebastian', roomId: 'r1' })
    expect((await roomRow('r1'))?.updated_at).toBe(NOW2)
    expect((await roomRow('r2'))?.updated_at).toBe(100)
    expect(await db.messages.updateText(999_999, 'x', NOW2 + 1)).toBeNull()
    expect((await roomRow('r1'))?.updated_at).toBe(NOW2)
  })

  it('SRV-T-128 messages_deleteById_touches_room_before_delete', async () => {
    const db = createDb(env.DB)
    await insertRoom('r1', 'R', 1, 100)
    await insertRoom('r2', 'R2', 1, 100)
    const [id] = await insertLines('r1', 1)
    expect(await db.messages.deleteById(id ?? 0, NOW2)).toBe(true)
    expect(await countWhere('messages', 'id = ?1', id ?? 0)).toBe(0)
    expect((await roomRow('r1'))?.updated_at).toBe(NOW2)
    expect(await db.messages.deleteById(999_999, NOW2 + 1)).toBe(false)
    expect((await roomRow('r1'))?.updated_at).toBe(NOW2)
    expect((await roomRow('r2'))?.updated_at).toBe(100)
  })
})

describe('rateLimits repo', () => {
  it('SRV-T-126 rateLimits_hit_counts_up_to_limit_then_returns_null', async () => {
    const db = createDb(env.DB)
    const W = 120_000
    expect([
      await db.rateLimits.hit('a', W, 3),
      await db.rateLimits.hit('a', W, 3),
      await db.rateLimits.hit('a', W, 3),
      await db.rateLimits.hit('a', W, 3),
    ]).toEqual([1, 2, 3, null])
    expect(await countWhere('rate_limits', "mb_id = 'a' AND count = 3")).toBe(1)
    expect(await db.rateLimits.hit('a', W + 60_000, 3)).toBe(1)
    expect(await db.rateLimits.hit('b', W, 3)).toBe(1)
  })

  it('SRV-T-127 rateLimits_purgeBefore_deletes_only_older_windows', async () => {
    const db = createDb(env.DB)
    const W = 600_000
    for (const w of [W - 120_000, W - 60_000, W]) await db.rateLimits.hit('a', w, 5)
    expect(await db.rateLimits.purgeBefore(W)).toBe(2)
    expect(await countWhere('rate_limits', 'window_start = ?1', W)).toBe(1)
    expect(await countWhere('rate_limits', '1 = 1')).toBe(1)
  })
})

const speakingUntil = async (id: string): Promise<number | null | undefined> =>
  (
    await env.DB.prepare('SELECT speaking_until AS s FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ s: number | null }>()
  )?.s

describe('S3 잠금·단건·요약', () => {
  beforeEach(resetDb)

  it('SRV-T-187 rooms_acquireSpeakLock_acquires_only_when_free_or_expired', async () => {
    const db = createDb(env.DB)
    await insertRoom('a', 'A', 1, 100)
    expect(await db.rooms.acquireSpeakLock('a', 1090, 1000)).toBe('acquired')
    expect(await speakingUntil('a')).toBe(1090)
    expect(await db.rooms.acquireSpeakLock('a', 5000, 1089)).toBe('busy')
    expect(await speakingUntil('a')).toBe(1090)
    expect(await db.rooms.acquireSpeakLock('a', 5000, 1090)).toBe('acquired')
    expect(await speakingUntil('a')).toBe(5000)
    expect(await db.rooms.acquireSpeakLock('a', 9000, 6000)).toBe('acquired')
    const row = await env.DB.prepare('SELECT updated_at FROM rooms WHERE id = ?1')
      .bind('a')
      .first<{ updated_at: number }>()
    expect(row?.updated_at).toBe(100)
  })

  it('SRV-T-188 rooms_acquireSpeakLock_returns_missing_for_unknown_room', async () => {
    const db = createDb(env.DB)
    await insertRoom('a', 'A', 1, 100)
    expect(await db.rooms.acquireSpeakLock('zzz', 2000, 1000)).toBe('missing')
    expect(await speakingUntil('a')).toBeNull()
  })

  it('SRV-T-189 rooms_releaseSpeakLock_clears_only_own_lock', async () => {
    const db = createDb(env.DB)
    await insertRoom('a', 'A', 1, 100)
    await db.rooms.acquireSpeakLock('a', 2000, 1000)
    expect(await db.rooms.releaseSpeakLock('a', 1999)).toBe(false)
    expect(await speakingUntil('a')).toBe(2000)
    expect(await db.rooms.releaseSpeakLock('a', 2000)).toBe(true)
    expect(await speakingUntil('a')).toBeNull()
    expect(await db.rooms.releaseSpeakLock('zzz', 2000)).toBe(false)
  })

  it('SRV-T-190 messages_getById_and_memory_getSummary', async () => {
    const db = createDb(env.DB)
    await insertRoom('a', 'A', 1, 100)
    const id = await insertLine('a', 'hello', 5)
    const m = await db.messages.getById(id)
    expect(m).toEqual({
      id,
      roomId: 'a',
      speaker: 'sebastian',
      kind: 'line',
      text: 'hello',
      authorName: null,
      createdAt: 5,
    })
    expect(Object.keys(m ?? {})).toHaveLength(7)
    expect(await db.messages.getById(id + 999)).toBeNull()
    expect(await db.memory.getSummary('a')).toBeNull()
    await env.DB.prepare(
      "INSERT INTO memory (room_id, summary, updated_at) VALUES ('a', '요약', 1)",
    ).run()
    expect(await db.memory.getSummary('a')).toBe('요약')
    await env.DB.prepare("UPDATE memory SET summary = '' WHERE room_id = 'a'").run()
    expect(await db.memory.getSummary('a')).toBe('')
  })
})

// ---- S3b (SRV-T-223·224) — doc/200_설계/server/db.md §8 ----
describe('llm_usage (S3b)', () => {
  it('SRV-T-223 migration_0002_creates_llm_usage_with_checks', async () => {
    expect(await columns('llm_usage')).toEqual([
      ['month', 'TEXT', 0, 1],
      ['calls', 'INTEGER', 1, 0],
      ['prompt_tokens', 'INTEGER', 1, 0],
      ['output_tokens', 'INTEGER', 1, 0],
      ['est_krw', 'REAL', 1, 0],
      ['updated_at', 'INTEGER', 1, 0],
    ])
    const insert = (month: string, calls: number, est: number) =>
      env.DB.prepare(
        'INSERT INTO llm_usage (month, calls, prompt_tokens, output_tokens, est_krw, updated_at) VALUES (?1, ?2, 0, 0, ?3, 1)',
      )
        .bind(month, calls, est)
        .run()
    await expect(insert('bad', 1, 0)).rejects.toThrow()
    await expect(insert('2026-1', 1, 0)).rejects.toThrow()
    await expect(insert('2026-10', 1, -1)).rejects.toThrow()
    await expect(insert('2026-10', 0, 0)).rejects.toThrow()
    await insert('2026-10', 1, 0)
  })

  it('SRV-T-224 llmUsage_add_accumulates_and_get_reads', async () => {
    const db = createDb(env.DB)
    expect(await db.llmUsage.get('2026-10')).toBeNull()
    const first = await db.llmUsage.add(
      '2026-10',
      { promptTokens: 100, outputTokens: 20, estKrw: 0.112 },
      1,
    )
    expect(first).toEqual({
      month: '2026-10',
      calls: 1,
      promptTokens: 100,
      outputTokens: 20,
      estKrw: 0.112,
    })
    const second = await db.llmUsage.add(
      '2026-10',
      { promptTokens: 100, outputTokens: 20, estKrw: 0.112 },
      2,
    )
    expect([second.calls, second.promptTokens, second.outputTokens]).toEqual([2, 200, 40])
    expect(second.estKrw).toBeCloseTo(0.224, 9)
    const raw = await env.DB.prepare('SELECT updated_at AS u FROM llm_usage WHERE month = ?1')
      .bind('2026-10')
      .first<{ u: number }>()
    expect(raw?.u).toBe(2)
    const other = await db.llmUsage.add(
      '2026-11',
      { promptTokens: 1, outputTokens: 1, estKrw: 0 },
      3,
    )
    expect(other.calls).toBe(1)
    expect(await db.llmUsage.get('2026-10')).toEqual(second)
    expect(await db.llmUsage.get('2026-09')).toBeNull()
  })
})

describe('character_settings (S3c)', () => {
  it('SRV-T-239 characterSettings_get_upsert_and_checks', async () => {
    const db = createDb(env.DB)
    expect(await db.characterSettings.get()).toBeNull()
    expect(await db.characterSettings.upsert('{"a":1}', 'owner_test', 100)).toEqual({
      version: 1,
      updatedAt: 100,
    })
    expect(await db.characterSettings.upsert('{"a":2}', 'owner_test', 200)).toEqual({
      version: 2,
      updatedAt: 200,
    })
    expect(await db.characterSettings.get()).toEqual({
      json: '{"a":2}',
      version: 2,
      updatedAt: 200,
    })
    const insert = (id: number, json: string, by: string) =>
      env.DB.prepare(
        'INSERT INTO character_settings (id, json, version, updated_at, updated_by) VALUES (?1, ?2, 1, 1, ?3)',
      )
        .bind(id, json, by)
        .run()
    await expect(insert(2, '{}', 'owner_test')).rejects.toThrow()
    await expect(db.characterSettings.upsert('{}', 'x'.repeat(21), 300)).rejects.toThrow()
    await expect(
      db.characterSettings.upsert('x'.repeat(200_001), 'owner_test', 300),
    ).rejects.toThrow()
    await env.DB.prepare('DELETE FROM character_settings').run()
    await insert(1, '{{', 'owner_test')
    expect((await db.characterSettings.get())?.json).toBe('{{')
  })
})
