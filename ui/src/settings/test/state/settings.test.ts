/**
 * TC-ST-032 — ui/src/state/settings.ts 순수 함수 S-01~S-15 · 리듀서 T-01~T-10 · S-08 ⇔ S-07 불변식
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 ui/src/settings/design/state.md §2
 * - React·DOM·api 없음. 입력은 깊게 얼려(deepFreeze) 불변을 확인한다.
 */
import { describe, expect, it } from 'vitest'
import type { CharacterId, CharacterSettingFields, CharacterSettings } from '@shared/types'
import { CHARACTER_FIELD_KEYS } from '@shared/settings'
import {
  INITIAL_SETTINGS_STATE,
  SETTINGS_TABS,
  canRevertSettings,
  canSaveSettings,
  checkPatchedSettings,
  draftFromSettings,
  exportTargetOf,
  fieldCount,
  fieldIssueOf,
  isDraftDirty,
  linesToList,
  listToLines,
  normalizeDraft,
  precheckDraft,
  settingsEqual,
  settingsReducer,
  statusOf,
  tabHasIssue,
} from '@/state/settings'
import type { ReadyState, SettingsDraft, SettingsState } from '@/state/settings'
import {
  BASE_SETTINGS,
  DEFAULT_RESPONSE,
  SAVED_AT,
  SAVED_RESPONSE,
  chars,
  withCharField,
} from '../fixtures'

const deepFreeze = <V>(value: V): V => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const clone = <V>(value: V): V => JSON.parse(JSON.stringify(value)) as V

const setChar = (
  d: SettingsDraft,
  id: CharacterId,
  key: keyof CharacterSettingFields,
  value: string,
): SettingsDraft => ({
  world: d.world,
  characters: { ...d.characters, [id]: { ...d.characters[id], [key]: value } },
})

const setWorld = (d: SettingsDraft, value: string): SettingsDraft => ({ world: value, characters: d.characters })

const baseDraft = (): SettingsDraft => draftFromSettings(BASE_SETTINGS)

const ready = (over: Partial<ReadyState> = {}): ReadyState => ({
  phase: 'ready',
  base: SAVED_RESPONSE,
  draft: baseDraft(),
  modelDraft: SAVED_RESPONSE.model, // (S3f) 'pro' = 기준값과 같음 → 모델 변경 없음
  isSaving: false,
  isStale: false,
  ...over,
})

const anyFieldIssue = (d: SettingsDraft): boolean =>
  fieldIssueOf(d, { tab: 'world' }) !== null ||
  (['sebastian', 'ciel'] as const).some(id =>
    CHARACTER_FIELD_KEYS.some(key => fieldIssueOf(d, { tab: id, key }) !== null),
  )

describe('TC-ST-032: 초안 변환 S-01~S-06', () => {
  it('TC-ST-032: S-01 listToLines · S-02 linesToList(trim·빈 줄 제거·\\r\\n)', () => {
    expect(listToLines(['a', 'b'])).toBe('a\nb')
    expect(listToLines([])).toBe('')
    expect(linesToList(' x \r\n\n y ')).toEqual(['x', 'y'])
    expect(linesToList('')).toEqual([])
    expect(linesToList('\n  \n')).toEqual([])
  })

  it('TC-ST-032: S-03 draftFromSettings — 목록은 줄 글, 키 순서 = CHARACTER_FIELD_KEYS, 입력 불변·새 객체', () => {
    const input = deepFreeze(clone(BASE_SETTINGS))
    const draft = draftFromSettings(input)
    expect(draft.world).toBe(BASE_SETTINGS.world)
    expect(draft.characters.sebastian.sampleDialogue).toBe('예, 도련님.\n팬텀하이브 가의 집사라면 이 정도는.')
    expect(draft.characters.ciel.rules).toBe('약한 모습을 보이지 않는다')
    expect(Object.keys(draft.characters.sebastian)).toEqual([...CHARACTER_FIELD_KEYS])
    expect(Object.keys(draft.characters)).toEqual(['sebastian', 'ciel'])
    expect(draft.characters.sebastian).not.toBe(input.characters.sebastian)
    expect(input).toEqual(BASE_SETTINGS)
  })

  it('TC-ST-032: S-04 normalizeDraft — trim·목록 분해, 길이 검사 없음(801자 그대로)', () => {
    const d = setChar(setWorld(baseDraft(), '  런던  '), 'sebastian', 'speech', ` ${chars(801)} `)
    const n = normalizeDraft(setChar(d, 'sebastian', 'sampleDialogue', ' x \n\n y '))
    expect(n.world).toBe('런던')
    expect(n.characters.sebastian.speech).toBe(chars(801))
    expect(n.characters.sebastian.sampleDialogue).toEqual(['x', 'y'])
  })

  it('TC-ST-032: S-05 settingsEqual — 키 순서 무관, 목록 길이·항목 비교', () => {
    const reordered: CharacterSettings = { characters: BASE_SETTINGS.characters, world: BASE_SETTINGS.world }
    expect(settingsEqual(BASE_SETTINGS, reordered)).toBe(true)
    expect(settingsEqual(BASE_SETTINGS, withCharField(BASE_SETTINGS, 'ciel', 'rules', []))).toBe(false)
    expect(settingsEqual(BASE_SETTINGS, withCharField(BASE_SETTINGS, 'sebastian', 'sampleDialogue', ['예, 도련님.', '다름']))).toBe(false)
  })

  it('TC-ST-032: S-06 isDraftDirty — 공백만 바꾸면 false, 실제 변경 true, 줄바꿈 든 저장 항목도 열자마자 false(L-1)', () => {
    expect(isDraftDirty(baseDraft(), BASE_SETTINGS)).toBe(false)
    expect(isDraftDirty(setChar(baseDraft(), 'sebastian', 'speech', '  정중한 존댓말  '), BASE_SETTINGS)).toBe(false)
    expect(isDraftDirty(setChar(baseDraft(), 'sebastian', 'speech', '바뀐 말투'), BASE_SETTINGS)).toBe(true)
    const multiline = withCharField(BASE_SETTINGS, 'ciel', 'rules', ['첫 줄\n둘째 줄'])
    expect(isDraftDirty(draftFromSettings(multiline), multiline)).toBe(false)
  })
})

describe('TC-ST-032: 검사 S-07~S-10', () => {
  it('TC-ST-032: S-07 precheckDraft — 통과 값 = 정규화 값, 실패 = checkCharacterSettings 첫 위반 문장', () => {
    const okResult = precheckDraft(setChar(baseDraft(), 'sebastian', 'speech', ' 새 말투 '))
    expect(okResult.ok).toBe(true)
    if (okResult.ok) expect(okResult.value.characters.sebastian.speech).toBe('새 말투')
    const bad = precheckDraft(setChar(baseDraft(), 'ciel', 'speech', chars(801)))
    expect(bad).toEqual({ ok: false, issue: { path: ['characters', 'ciel', 'speech'], message: '시엘 · 말투는 1~800자여야 합니다.' } })
    const blankWorld = precheckDraft(setWorld(baseDraft(), '   '))
    expect(blankWorld.ok ? '' : blankWorld.issue.message).toBe('공통 · 세계관은 1~2000자여야 합니다.')
  })

  it('TC-ST-032: S-08 fieldIssueOf — required · tooLong · tooManyLines · lineTooLong(빈 줄 제거 뒤 번호)', () => {
    expect(fieldIssueOf(setWorld(baseDraft(), '  '), { tab: 'world' })).toEqual({ kind: 'required' })
    expect(fieldIssueOf(setWorld(baseDraft(), chars(2001)), { tab: 'world' })).toEqual({ kind: 'tooLong', max: 2000 })
    const speech = (v: string) => fieldIssueOf(setChar(baseDraft(), 'sebastian', 'speech', v), { tab: 'sebastian', key: 'speech' })
    expect(speech(chars(800))).toBeNull()
    expect(speech(chars(801))).toEqual({ kind: 'tooLong', max: 800 })
    expect(speech('😀'.repeat(800))).toBeNull()
    const sample = (v: string) =>
      fieldIssueOf(setChar(baseDraft(), 'sebastian', 'sampleDialogue', v), { tab: 'sebastian', key: 'sampleDialogue' })
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `줄${i + 1}`).join('\n')
    expect(sample(lines(10))).toBeNull()
    expect(sample(lines(11))).toEqual({ kind: 'tooManyLines', maxItems: 10 })
    expect(sample(`\n\n짧은 줄\n${chars(201)}`)).toEqual({ kind: 'lineTooLong', lineNo: 2, itemMax: 200 })
    expect(sample(chars(200))).toBeNull()
    expect(fieldIssueOf(setChar(baseDraft(), 'ciel', 'age', chars(41)), { tab: 'ciel', key: 'age' })).toEqual({ kind: 'tooLong', max: 40 })
    expect(fieldIssueOf(setChar(baseDraft(), 'ciel', 'age', ''), { tab: 'ciel', key: 'age' })).toBeNull()
  })

  it('TC-ST-032: S-09 tabHasIssue · S-10 fieldCount', () => {
    const d = setChar(baseDraft(), 'ciel', 'appearance', chars(801))
    expect(tabHasIssue(d, 'ciel')).toBe(true)
    expect(tabHasIssue(d, 'sebastian')).toBe(false)
    expect(tabHasIssue(d, 'world')).toBe(false)
    expect(fieldCount(setWorld(baseDraft(), '  ab '), { tab: 'world' })).toEqual({ count: 2, max: 2000, unit: 'chars' })
    expect(
      fieldCount(setChar(baseDraft(), 'sebastian', 'sampleDialogue', ' x \n\n y '), { tab: 'sebastian', key: 'sampleDialogue' }),
    ).toEqual({ count: 2, max: 10, unit: 'lines' })
    expect(fieldCount(baseDraft(), { tab: 'ciel', key: 'rules' })).toEqual({ count: 1, max: 20, unit: 'lines' })
  })

  it('TC-ST-032: 불변식 — precheckDraft(d).ok === false ⇔ 어떤 필드든 fieldIssueOf ≠ null (경계 벡터)', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`).join('\n')
    const vectors: SettingsDraft[] = [
      baseDraft(),
      setWorld(baseDraft(), chars(2000)),
      setWorld(baseDraft(), chars(2001)),
      setWorld(baseDraft(), ' '),
      setChar(baseDraft(), 'sebastian', 'speech', chars(800)),
      setChar(baseDraft(), 'sebastian', 'speech', chars(801)),
      setChar(baseDraft(), 'ciel', 'persona', '   '),
      setChar(baseDraft(), 'ciel', 'age', chars(41)),
      setChar(baseDraft(), 'sebastian', 'sampleDialogue', lines(10)),
      setChar(baseDraft(), 'sebastian', 'sampleDialogue', lines(11)),
      setChar(baseDraft(), 'sebastian', 'sampleDialogue', chars(200)),
      setChar(baseDraft(), 'sebastian', 'sampleDialogue', chars(201)),
      setChar(baseDraft(), 'ciel', 'rules', lines(20)),
      setChar(baseDraft(), 'ciel', 'rules', lines(21)),
    ]
    for (const d of vectors) expect(precheckDraft(d).ok).toBe(!anyFieldIssue(d))
  })
})

describe('TC-ST-032: 활성·상태 S-11~S-14', () => {
  const dirty = setChar(baseDraft(), 'sebastian', 'speech', '바뀐 말투')
  const invalid = setChar(baseDraft(), 'sebastian', 'speech', chars(801))

  it('TC-ST-032: S-11 canSaveSettings · S-12 canRevertSettings', () => {
    expect(canSaveSettings(INITIAL_SETTINGS_STATE)).toBe(false)
    expect(canSaveSettings(ready())).toBe(false)
    expect(canSaveSettings(ready({ draft: dirty }))).toBe(true)
    expect(canSaveSettings(ready({ draft: invalid }))).toBe(false)
    expect(canSaveSettings(ready({ draft: dirty, isSaving: true }))).toBe(false)
    expect(canSaveSettings(ready({ draft: dirty, isStale: true }))).toBe(false)
    expect(canRevertSettings(ready())).toBe(false)
    expect(canRevertSettings(ready({ draft: invalid }))).toBe(true)
    expect(canRevertSettings(ready({ draft: dirty, isStale: true }))).toBe(false)
    expect(canRevertSettings(ready({ draft: dirty, isSaving: true }))).toBe(false)
  })

  it('TC-ST-032: S-13 exportTargetOf — 평소 base.settings, stale 이면 정규화 초안(801자도 그대로)', () => {
    const s = ready({ draft: invalid })
    expect(exportTargetOf(s)).toBe(SAVED_RESPONSE.settings)
    const stale = exportTargetOf(ready({ draft: invalid, isStale: true }))
    expect(stale.characters.sebastian.speech).toBe(chars(801))
    expect(stale.characters.sebastian.sampleDialogue).toEqual(SAVED_RESPONSE.settings.characters.sebastian.sampleDialogue)
  })

  it('TC-ST-032: S-14 statusOf — saving > stale > invalid > dirty > default > saved', () => {
    expect(statusOf(ready({ draft: invalid, isSaving: true, isStale: true }))).toEqual({ kind: 'saving' })
    expect(statusOf(ready({ draft: invalid, isStale: true }))).toEqual({ kind: 'stale' })
    expect(statusOf(ready({ draft: invalid }))).toEqual({ kind: 'invalid', message: '세바스찬 · 말투는 1~800자여야 합니다.' })
    expect(statusOf(ready({ draft: dirty }))).toEqual({ kind: 'dirty' })
    expect(statusOf(ready({ base: DEFAULT_RESPONSE }))).toEqual({ kind: 'default' })
    expect(statusOf(ready({ base: { ...SAVED_RESPONSE, isDefault: false, updatedAt: null } }))).toEqual({ kind: 'default' })
    expect(statusOf(ready())).toEqual({ kind: 'saved', version: 3, updatedAt: SAVED_AT })
  })
})

describe('TC-ST-032: S-15 checkPatchedSettings (벡터 V-4 · V-6 재사용)', () => {
  it('TC-ST-032: V-4 — ciel.speech 801자 덮기 → ok false, 시엘 · 말투는 1~800자여야 합니다., base 불변', () => {
    const base = deepFreeze(clone(BASE_SETTINGS))
    const r = checkPatchedSettings(base, { characters: { ciel: { speech: chars(801) } } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issue.message).toBe('시엘 · 말투는 1~800자여야 합니다.')
    expect(base).toEqual(BASE_SETTINGS)
  })

  it('TC-ST-032: V-6 — 통과 base + world 만 → ok true, 값 = base 위에 world 만 바뀐 정규화 값', () => {
    const base = deepFreeze(clone(BASE_SETTINGS))
    const r = checkPatchedSettings(base, { world: '  안개 낀 런던(E)  ', characters: {} })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.world).toBe('안개 낀 런던(E)')
      expect(r.value.characters).toEqual(BASE_SETTINGS.characters)
    }
    expect(base).toEqual(BASE_SETTINGS)
  })

  it('TC-ST-032: 자체 형식 빈 필수 world:\'\' · speech:\'\' 덮기 → 필수 위반 문장', () => {
    const w = checkPatchedSettings(BASE_SETTINGS, { world: '', characters: {} })
    expect(w.ok ? '' : w.issue.message).toBe('공통 · 세계관은 1~2000자여야 합니다.')
    const s = checkPatchedSettings(BASE_SETTINGS, { characters: { sebastian: { speech: '' } } })
    expect(s.ok ? '' : s.issue.message).toBe('세바스찬 · 말투는 1~800자여야 합니다.')
  })
})

describe('TC-ST-032: 리듀서 T-01~T-10 (불변 · 무시 조합)', () => {
  it('TC-ST-032: 상수 — 탭 순서 · 초기 상태', () => {
    expect(SETTINGS_TABS).toEqual(['world', 'sebastian', 'ciel'])
    expect(INITIAL_SETTINGS_STATE).toEqual({ phase: 'loading' })
  })

  it('TC-ST-032: T-01 loadStarted · T-02 loadSucceeded · T-03 loadFailed', () => {
    const err = deepFreeze<SettingsState>({ phase: 'error', error: { code: 'NETWORK', message: '' } })
    expect(settingsReducer(err, { type: 'loadStarted' })).toEqual({ phase: 'loading' })
    expect(settingsReducer(deepFreeze(ready()), { type: 'loadStarted' })).toEqual({ phase: 'loading' })
    const loaded = settingsReducer(INITIAL_SETTINGS_STATE, { type: 'loadSucceeded', response: SAVED_RESPONSE })
    expect(loaded).toEqual({
      phase: 'ready',
      base: SAVED_RESPONSE,
      draft: baseDraft(),
      modelDraft: 'pro',
      isSaving: false,
      isStale: false,
    })
    const error = { code: 'INTERNAL', message: 'x' } as const
    expect(settingsReducer(INITIAL_SETTINGS_STATE, { type: 'loadFailed', error })).toEqual({ phase: 'error', error })
  })

  it('TC-ST-032: T-04 편집 — 그 필드만 새 값, 나머지 참조 유지 · 저장 중 무시 · stale 허용', () => {
    const prev = deepFreeze(ready())
    const w = settingsReducer(prev, { type: 'worldChanged', value: '새 세계' })
    expect(w.phase === 'ready' && w.draft.world).toBe('새 세계')
    expect(w.phase === 'ready' && w.draft.characters).toBe(prev.draft.characters)
    const c = settingsReducer(prev, { type: 'characterFieldChanged', id: 'ciel', key: 'speech', value: '반말' })
    expect(c.phase === 'ready' && c.draft.characters.ciel.speech).toBe('반말')
    expect(c.phase === 'ready' && c.draft.characters.sebastian).toBe(prev.draft.characters.sebastian)
    const saving = deepFreeze(ready({ isSaving: true }))
    expect(settingsReducer(saving, { type: 'worldChanged', value: 'x' })).toBe(saving)
    const stale = deepFreeze(ready({ isStale: true }))
    const s = settingsReducer(stale, { type: 'worldChanged', value: 'stale 입력' })
    expect(s.phase === 'ready' && s.draft.world).toBe('stale 입력')
  })

  it('TC-ST-032: T-05 reverted · T-06 imported — stale·저장 중 무시, patch 위치만 덮음(목록 = 줄 글)', () => {
    const dirty = deepFreeze(ready({ draft: setChar(baseDraft(), 'sebastian', 'speech', '바뀜') }))
    const reverted = settingsReducer(dirty, { type: 'reverted' })
    expect(reverted.phase === 'ready' && reverted.draft).toEqual(baseDraft())
    const staleDirty = deepFreeze(ready({ draft: dirty.draft, isStale: true }))
    expect(settingsReducer(staleDirty, { type: 'reverted' })).toBe(staleDirty)
    const savingDirty = deepFreeze(ready({ draft: dirty.draft, isSaving: true }))
    expect(settingsReducer(savingDirty, { type: 'reverted' })).toBe(savingDirty)

    const unsaved = setChar(baseDraft(), 'sebastian', 'appearance', chars(801))
    const prev = deepFreeze(ready({ draft: unsaved }))
    const patch = { world: '가져온 세계', characters: { ciel: { sampleDialogue: ['a', 'b'], speech: '가져온 말투' } } }
    const next = settingsReducer(prev, { type: 'imported', patch })
    expect(next.phase === 'ready' && next.draft.world).toBe('가져온 세계')
    expect(next.phase === 'ready' && next.draft.characters.ciel.sampleDialogue).toBe('a\nb')
    expect(next.phase === 'ready' && next.draft.characters.ciel.speech).toBe('가져온 말투')
    expect(next.phase === 'ready' && next.draft.characters.ciel.persona).toBe(prev.draft.characters.ciel.persona)
    expect(next.phase === 'ready' && next.draft.characters.sebastian.appearance).toBe(chars(801))
    const stale = deepFreeze(ready({ isStale: true }))
    expect(settingsReducer(stale, { type: 'imported', patch })).toBe(stale)
  })

  it('TC-ST-032: T-07~T-10 저장 — started · succeeded(초안·기준 = 응답) · failed(초안 유지) · staleEntered', () => {
    const edited = setChar(baseDraft(), 'sebastian', 'speech', '바뀐 말투')
    const started = settingsReducer(deepFreeze(ready({ draft: edited })), { type: 'saveStarted' })
    expect(started.phase === 'ready' && started.isSaving).toBe(true)
    const staleReady = deepFreeze(ready({ isStale: true }))
    expect(settingsReducer(staleReady, { type: 'saveStarted' })).toBe(staleReady)

    const savedSettings = withCharField(BASE_SETTINGS, 'sebastian', 'speech', '바뀐 말투')
    const response = { settings: savedSettings, version: 4, updatedAt: SAVED_AT + 60000, isDefault: false, model: 'pro' as const }
    const succeeded = settingsReducer(deepFreeze(started), { type: 'saveSucceeded', response })
    expect(succeeded).toEqual({
      phase: 'ready',
      base: response,
      draft: draftFromSettings(savedSettings),
      modelDraft: 'pro',
      isSaving: false,
      isStale: false,
    })
    const notSaving = deepFreeze(ready())
    expect(settingsReducer(notSaving, { type: 'saveSucceeded', response })).toBe(notSaving)

    const failed = settingsReducer(deepFreeze(started), { type: 'saveFailed' })
    expect(failed.phase === 'ready' && failed.isSaving).toBe(false)
    expect(failed.phase === 'ready' && failed.draft).toEqual(edited)

    const stale = settingsReducer(deepFreeze(started), { type: 'staleEntered' })
    expect(stale.phase === 'ready' && [stale.isSaving, stale.isStale]).toEqual([false, true])
    expect(stale.phase === 'ready' && stale.draft).toEqual(edited)
  })

  it('TC-ST-032: 그 밖 조합 — 같은 참조 반환(늦은 응답 방어)', () => {
    const loading = INITIAL_SETTINGS_STATE
    expect(settingsReducer(loading, { type: 'worldChanged', value: 'x' })).toBe(loading)
    expect(settingsReducer(loading, { type: 'saveSucceeded', response: SAVED_RESPONSE })).toBe(loading)
    const err = deepFreeze<SettingsState>({ phase: 'error', error: { code: 'NETWORK', message: '' } })
    expect(settingsReducer(err, { type: 'reverted' })).toBe(err)
    const r = deepFreeze(ready())
    expect(settingsReducer(r, { type: 'loadSucceeded', response: DEFAULT_RESPONSE })).toBe(r)
    expect(settingsReducer(r, { type: 'saveFailed' })).toBe(r)
  })
})
