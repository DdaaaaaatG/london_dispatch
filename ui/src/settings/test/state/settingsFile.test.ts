/**
 * TC-ST-034 · TC-ST-035 — ui/src/state/settingsFile.ts (SF-01~SF-06 · parseImportFile 벡터 · V-1~V-6)
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 ui/src/settings/design/state.md §3 · 정본 api.md §16
 * - 순수 함수. DOM·api 없음. 결과·파일 내용을 console 에 남기지 않는다(R-SET-012) → console 0회 단언.
 * - SF-07~SF-10(후보 만들기·patch 꺼내기)은 모듈 내부라 parseImportFile 결과로 관찰한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterSettings } from '@shared/types'
import { CHARACTER_FIELD_KEYS, SETTINGS_IMPORT_MAX_BYTES } from '@shared/settings'
import {
  detectImportSource,
  exportFileName,
  parseImportFile,
  serializeExportFile,
  toExportFile,
  utf8ByteLength,
} from '@/state/settingsFile'
import type { ImportResult } from '@/state/settingsFile'
import { draftFromSettings, precheckDraft, settingsReducer } from '@/state/settings'
import type { ReadyState } from '@/state/settings'
import {
  BASE_SETTINGS,
  SAVED_RESPONSE,
  chars,
  enosBackup,
  enosChar,
  enosWorld,
  selfFile,
  withCharField,
} from '../fixtures'

const SECRET_PATTERN = /apiKey|API_KEY|SECRET|token/
const consoleSpies: ReturnType<typeof vi.spyOn>[] = []

beforeEach(() => {
  consoleSpies.push(
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  )
})

afterEach(() => {
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled()
  consoleSpies.length = 0
  vi.restoreAllMocks()
})

const parse = (root: unknown, base: CharacterSettings = BASE_SETTINGS): ImportResult =>
  parseImportFile(JSON.stringify(root), base)

const success = (r: ImportResult) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`)
  return r
}

const fieldCountOf = (r: ImportResult): number => {
  const s = success(r)
  const fields = Object.values(s.patch.characters).reduce((n, c) => n + Object.keys(c ?? {}).length, 0)
  return fields + (s.patch.world === undefined ? 0 : 1)
}

describe('TC-ST-034: 내보내기 SF-01~SF-04 (R-SET-007 · R-NFR-004)', () => {
  const NOW = new Date(2026, 9, 6, 9, 5)

  it('TC-ST-034: toExportFile — 최상위 키 4개, settings = world + 2명 × 11필드(순서), 목록은 복사', () => {
    const file = toExportFile(BASE_SETTINGS, NOW)
    expect(Object.keys(file)).toEqual(['format', 'formatVersion', 'exportedAt', 'settings'])
    expect(file.format).toBe('london-dispatch/character-settings')
    expect(file.formatVersion).toBe(1)
    expect(file.exportedAt).toBe(NOW.toISOString())
    expect(Object.keys(file.settings)).toEqual(['world', 'characters'])
    expect(Object.keys(file.settings.characters)).toEqual(['sebastian', 'ciel'])
    expect(Object.keys(file.settings.characters.sebastian)).toEqual([...CHARACTER_FIELD_KEYS])
    expect(Object.keys(file.settings.characters.ciel)).toEqual([...CHARACTER_FIELD_KEYS])
    expect(file.settings).toEqual(BASE_SETTINGS)
    expect(file.settings.characters.sebastian.rules).not.toBe(BASE_SETTINGS.characters.sebastian.rules)
  })

  it('TC-ST-034: 입력에 apiKey·version·token 을 섞어도 출력 0건 · 직렬화 문자열 금지 패턴 0건', () => {
    const polluted = {
      ...BASE_SETTINGS,
      apiKey: 'sk-LEAK',
      version: 9,
      updatedAt: 1,
      isDefault: false,
      characters: {
        sebastian: { ...BASE_SETTINGS.characters.sebastian, token: 'tok-LEAK', outputRules: 'x' },
        ciel: BASE_SETTINGS.characters.ciel,
        grell: { speech: 'LEAK' },
      },
    } as unknown as CharacterSettings
    const text = serializeExportFile(toExportFile(polluted, NOW))
    expect(text).toBe(JSON.stringify(toExportFile(BASE_SETTINGS, NOW), null, 2))
    expect(SECRET_PATTERN.test(text)).toBe(false)
    expect(text).not.toMatch(/LEAK|version|updatedAt|isDefault|updatedBy|outputRules|grell/)
  })

  it('TC-ST-034: exportFileName 0 채움(현지 시각) · utf8ByteLength', () => {
    expect(exportFileName(NOW)).toBe('london-dispatch-characters-20261006-0905.json')
    expect(exportFileName(new Date(2026, 0, 1, 0, 0))).toBe('london-dispatch-characters-20260101-0000.json')
    expect(exportFileName(new Date(2026, 11, 31, 23, 59))).toBe('london-dispatch-characters-20261231-2359.json')
    expect(utf8ByteLength('a')).toBe(1)
    expect(utf8ByteLength('가')).toBe(3)
    expect(utf8ByteLength('😀')).toBe(4)
  })
})

describe('TC-ST-035: 판별 SF-06 · 거부 사유', () => {
  it('TC-ST-035: detectImportSource — self · unsupportedVersion · enosBackup · enosWorld · unknownFormat', () => {
    expect(detectImportSource(selfFile(BASE_SETTINGS))).toBe('self')
    expect(detectImportSource(selfFile(BASE_SETTINGS, 2))).toBe('unsupportedVersion')
    expect(detectImportSource(enosBackup([]))).toBe('enosBackup')
    expect(detectImportSource(enosWorld([]))).toBe('enosWorld')
    expect(detectImportSource({ characters: [], description: 5 })).toBe('unknownFormat')
    expect(detectImportSource({ DB: { worlds: {} } })).toBe('unknownFormat')
    expect(detectImportSource({ foo: 1 })).toBe('unknownFormat')
  })

  it('TC-ST-035: 잘못된 형식 — notJson · unknownFormat · unsupportedVersion · noMatchingWorld', () => {
    expect(parseImportFile('not json', BASE_SETTINGS)).toEqual({ ok: false, reason: 'notJson' })
    expect(parseImportFile('[1,2]', BASE_SETTINGS)).toEqual({ ok: false, reason: 'notJson' })
    expect(parseImportFile('"text"', BASE_SETTINGS)).toEqual({ ok: false, reason: 'notJson' })
    expect(parse({ foo: 1 })).toEqual({ ok: false, reason: 'unknownFormat' })
    expect(parse(selfFile(BASE_SETTINGS, 2))).toEqual({ ok: false, reason: 'unsupportedVersion' })
    expect(parse(enosBackup([{ name: '아무개' }]))).toEqual({ ok: false, reason: 'noMatchingWorld' })
  })

  it('TC-ST-035: 크기 — 5MB+1 바이트 → tooLarge, 정확히 5MB 는 크기 통과(→ notJson)', () => {
    expect(parseImportFile(' '.repeat(SETTINGS_IMPORT_MAX_BYTES + 1), BASE_SETTINGS)).toEqual({ ok: false, reason: 'tooLarge' })
    expect(parseImportFile(' '.repeat(SETTINGS_IMPORT_MAX_BYTES), BASE_SETTINGS)).toEqual({ ok: false, reason: 'notJson' })
  })
})

describe('TC-ST-035: 자체 형식 (R-SET-008)', () => {
  it('TC-ST-035: 자체 — 전 필드 후보, 정규화 값, applied 전부, 값이 같아도 다시 세지 않음', () => {
    const changed = withCharField({ ...BASE_SETTINGS, world: '  새 세계  ' }, 'ciel', 'rules', [' a ', '', 'b'])
    const r = success(parse(selfFile(changed)))
    expect(r.source).toBe('self')
    expect(r.patch.world).toBe('새 세계')
    expect(r.patch.characters.ciel?.rules).toEqual(['a', 'b'])
    expect(r.applied).toEqual({ world: true, sebastian: 11, ciel: 11 })
    expect(r.ignoredCount).toBe(0)
    const same = success(parse(selfFile(BASE_SETTINGS)))
    expect(same.applied).toEqual({ world: true, sebastian: 11, ciel: 11 })
    expect(same.ignoredCount).toBe(0)
  })

  it('TC-ST-035: ignoredCount — speech:3 · rules:\'x\' → 2 / 키 생략·null·화이트리스트 밖 → 0', () => {
    const typed = success(
      parse(selfFile({ world: '세계', characters: { sebastian: { speech: 3 }, ciel: { rules: 'x' } } })),
    )
    expect(typed.ignoredCount).toBe(2)
    expect(typed.patch.characters.sebastian?.speech).toBeUndefined()
    expect(typed.applied).toEqual({ world: true, sebastian: 0, ciel: 0 })
    const absent = success(
      parse(
        selfFile({
          apiKey: 'sk-LEAK',
          characters: { sebastian: { speech: null, extra: 'x', token: 'tok' }, ciel: {}, grell: { speech: 'x' } },
        }),
      ),
    )
    expect(absent.ignoredCount).toBe(0)
    expect(JSON.stringify(absent)).not.toMatch(/LEAK|apiKey|token|grell|extra/)
  })

  it('TC-ST-035: 배열에 문자열 아닌 항목 → 그 필드 1건 · settings/characters 가 객체가 아니면 그 아래는 "없음"', () => {
    const mixed = success(parse(selfFile({ characters: { sebastian: { sampleDialogue: ['a', 1, null] } } })))
    expect(mixed.ignoredCount).toBe(1)
    const notObject = success(parse(selfFile({ world: '세계', characters: 'oops' })))
    expect(notObject.ignoredCount).toBe(0)
    expect(notObject.applied).toEqual({ world: true, sebastian: 0, ciel: 0 })
    const noSettings = success(parse(selfFile(5)))
    expect(noSettings.ignoredCount).toBe(0)
    expect(fieldCountOf(noSettings)).toBe(0)
  })

  it('TC-ST-035: 후보 0개 → ok true, 빈 patch, applied 0·false', () => {
    const r = success(parse(selfFile({})))
    expect(fieldCountOf(r)).toBe(0)
    expect(r.applied).toEqual({ world: false, sebastian: 0, ciel: 0 })
    expect(r.ignoredCount).toBe(0)
  })

  it('TC-ST-035: 자체 형식 빈 필수 world:\'\' · sebastian.speech:\'\' → invalid(필수 위반 문장)', () => {
    expect(parse(selfFile({ world: '' }))).toEqual({
      ok: false,
      reason: 'invalid',
      message: '공통 · 세계관은 1~2000자여야 합니다.',
    })
    expect(parse(selfFile({ characters: { sebastian: { speech: '' } } }))).toEqual({
      ok: false,
      reason: 'invalid',
      message: '세바스찬 · 말투는 1~800자여야 합니다.',
    })
  })
})

describe('TC-ST-035: E.No.S (R-SET-008 · R-NFR-004)', () => {
  it('TC-ST-035: V-1 백업 — 첫 맞는 world, 매핑 8필드, persona·relationships·rules 없음, 무시 0, 비밀값 0', () => {
    const other = { name: '다른 세계', description: '엉뚱한 곳', characters: [{ name: '아무개' }] }
    const root = enosBackup([enosChar('세바스찬 미카엘리스'), enosChar('시엘 팬텀하이브', { voice: '반말(E)' })], [other])
    const r = success(parse(root))
    expect(r.source).toBe('enosBackup')
    expect(r.patch.world).toBe('안개 낀 런던(E)')
    expect(r.patch.characters.sebastian).toEqual({
      sourceMaterial: '흑집사(E)',
      age: '스물여덟',
      gender: '남(E)',
      role: '집사(E)',
      personalityTags: '침착, 유능',
      appearance: '키가 크다\n흑발\n붉은 눈\n흰 장갑',
      speech: '낮고 부드러운 존댓말(E)',
      sampleDialogue: ['예.', '알겠습니다.'],
    })
    expect(r.patch.characters.ciel?.speech).toBe('반말(E)')
    expect(r.applied).toEqual({ world: true, sebastian: 8, ciel: 8 })
    expect(r.ignoredCount).toBe(0)
    expect(JSON.stringify(r)).not.toMatch(/sk-SHOULD-NOT-LEAK|SHOULD-NOT-READ|apiKey|API_KEY|SECRET/)
  })

  it('TC-ST-035: 백업 — 맞는 world 가 둘이면 앞의 것, 같은 이름 캐릭터가 둘이면 첫 항목', () => {
    const first = { description: '첫 세계', characters: [enosChar('세바스찬', { voice: '첫 목소리' }), enosChar('세바스찬', { voice: '둘째' })] }
    const root = enosBackup([enosChar('세바스찬', { voice: '뒤 세계' })], [first])
    const r = success(parse(root))
    expect(r.patch.world).toBe('첫 세계')
    expect(r.patch.characters.sebastian?.speech).toBe('첫 목소리')
  })

  it('TC-ST-035: V-2 age:13 · gender:{} · sample_dialogue:[\'a\',1] → age \'13\', 무시 2, 두 필드 patch 없음', () => {
    const r = success(parse(enosBackup([enosChar('세바스찬', { age: 13, gender: {}, sample_dialogue: ['a', 1] })])))
    expect(r.patch.characters.sebastian?.age).toBe('13')
    expect(r.patch.characters.sebastian).not.toHaveProperty('gender')
    expect(r.patch.characters.sebastian).not.toHaveProperty('sampleDialogue')
    expect(r.ignoredCount).toBe(2)
    expect(r.applied.ciel).toBe(0)
  })

  it('TC-ST-035: V-3 voice:\'\' · job:null → 둘 다 없음, 무시 0, patch·applied 에 안 잡힘', () => {
    const r = success(parse(enosBackup([enosChar('세바스찬', { voice: '', job: null })])))
    expect(r.patch.characters.sebastian).not.toHaveProperty('speech')
    expect(r.patch.characters.sebastian).not.toHaveProperty('role')
    expect(r.ignoredCount).toBe(0)
    expect(r.applied.sebastian).toBe(6)
  })

  it('TC-ST-035: voice:5 · hair_style:[] → 무시 2(appearance 출처 각각) · personality_tags 문자열 그대로 · 빈 출처 제외', () => {
    const r = success(
      parse(enosBackup([enosChar('세바스찬', { voice: 5, hair_style: [], eyes: '  ', personality_tags: '침착' })])),
    )
    expect(r.ignoredCount).toBe(2)
    expect(r.patch.characters.sebastian?.appearance).toBe('키가 크다\n흰 장갑')
    expect(r.patch.characters.sebastian?.personalityTags).toBe('침착')
  })

  it('TC-ST-035: world 단독 — 캐릭터 있으면 그 캐릭터만, 없으면 world 만(무시 0)', () => {
    const withCiel = success(parse(enosWorld([enosChar('시엘')])))
    expect(withCiel.source).toBe('enosWorld')
    expect(withCiel.applied).toEqual({ world: true, sebastian: 0, ciel: 8 })
    const none = success(parse(enosWorld([{ name: '아무개' }])))
    expect(fieldCountOf(none)).toBe(1)
    expect(none.patch.world).toBe('안개 낀 런던(E)')
    expect(none.ignoredCount).toBe(0)
  })
})

describe('TC-ST-035: 보정 벡터 V-4 · V-5 · V-6 (api.md §16.3)', () => {
  it('TC-ST-035: V-4 자체 ciel.speech 801자 → invalid, 시엘 · 말투는 1~800자여야 합니다.(자르지 않음)', () => {
    const file = selfFile(withCharField(BASE_SETTINGS, 'ciel', 'speech', chars(801)))
    expect(parse(file)).toEqual({ ok: false, reason: 'invalid', message: '시엘 · 말투는 1~800자여야 합니다.' })
  })

  it('TC-ST-035: V-5 자체 sebastian.rules:\'a\' → 무시 1, 나머지 후보 반영', () => {
    const r = success(parse(selfFile({ ...BASE_SETTINGS, characters: { ...BASE_SETTINGS.characters, sebastian: { ...BASE_SETTINGS.characters.sebastian, rules: 'a' } } })))
    expect(r.ignoredCount).toBe(1)
    expect(r.patch.characters.sebastian).not.toHaveProperty('rules')
    expect(r.applied).toEqual({ world: true, sebastian: 10, ciel: 11 })
  })

  it('TC-ST-035: V-6 world 단독 + 초안 sebastian.appearance 801자 → 성공(world 만), 덮은 뒤 precheck 실패·801자 유지', () => {
    const r = success(parse(enosWorld([])))
    expect(fieldCountOf(r)).toBe(1)
    expect(r.ignoredCount).toBe(0)
    const draft = draftFromSettings(BASE_SETTINGS)
    const state: ReadyState = {
      phase: 'ready',
      base: SAVED_RESPONSE,
      draft: { world: draft.world, characters: { ...draft.characters, sebastian: { ...draft.characters.sebastian, appearance: chars(801) } } },
      isSaving: false,
      isStale: false,
    }
    const next = settingsReducer(state, { type: 'imported', patch: r.patch })
    if (next.phase !== 'ready') throw new Error('ready 아님')
    expect(next.draft.world).toBe('안개 낀 런던(E)')
    expect(next.draft.characters.sebastian.appearance).toBe(chars(801))
    const check = precheckDraft(next.draft)
    expect(check.ok ? '' : check.issue.message).toBe('세바스찬 · 외형은 800자 이하여야 합니다.')
  })
})
