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
