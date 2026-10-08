/**
 * TC-ST-051 (+ TC-ST-047 리듀서 절) — S3f 모델 선택 상태: T-02·T-05·T-06·T-08~T-11 · S-11·S-12·S-14·S-16·S-17 · §2.6 M-1
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 ui/src/settings/design/state.md §2.1~§2.3 · §2.6 · design.md §11 D-ST-12~15
 * - React·DOM·api 없음. 입력은 깊게 얼려(deepFreeze) 불변을 확인한다.
 * - 구현 전 작성(Red 정상): hasUnsavedChanges · modelToSave · 액션 modelChanged · ReadyState.modelDraft 는 설계 이름 그대로다.
 */
import { describe, expect, it } from 'vitest'
import type { CharacterSettingsResponse, LlmModelKey } from '@shared/types'
import {
  INITIAL_SETTINGS_STATE,
  canRevertSettings,
  canSaveSettings,
  draftFromSettings,
  hasUnsavedChanges,
  modelToSave,
  settingsReducer,
  statusOf,
} from '@/state/settings'
import type { ReadyState, SettingsDraft, SettingsState } from '@/state/settings'
import { serializeExportFile, toExportFile } from '@/state/settingsFile'
import { BASE_SETTINGS, FLASH_RESPONSE, SAVED_AT, SAVED_RESPONSE, UNSET_RESPONSE, chars, withCharField } from '../fixtures'

const deepFreeze = <V>(value: V): V => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const baseDraft = (): SettingsDraft => draftFromSettings(BASE_SETTINGS)
const bodyDirty = (): SettingsDraft => ({ world: '고친 세계', characters: baseDraft().characters })
const bodyInvalid = (): SettingsDraft => ({ world: chars(2001), characters: baseDraft().characters })

/** 기준값 base.model = 'pro'(SAVED_RESPONSE), 초안도 'pro' — 변경 없음 */
const ready = (over: Partial<ReadyState> = {}): ReadyState =>
  deepFreeze({
    phase: 'ready',
    base: SAVED_RESPONSE,
    draft: baseDraft(),
    modelDraft: SAVED_RESPONSE.model,
    isSaving: false,
    isStale: false,
    ...over,
  })

const asReady = (s: SettingsState): ReadyState => {
  if (s.phase !== 'ready') throw new Error(`ready 아님: ${s.phase}`)
  return s
}

describe('TC-ST-051: 리듀서 — modelDraft 전이 (state.md §2.3 · §2.4 요약)', () => {
  it.each<[string, CharacterSettingsResponse, LlmModelKey | null]>([
    ['pro', SAVED_RESPONSE, 'pro'],
    ['flash', FLASH_RESPONSE, 'flash'],
    ['null', UNSET_RESPONSE, null],
  ])('TC-ST-051: T-02 loadSucceeded(model %s) → modelDraft = response.model', (_, response, expected) => {
    const s = asReady(settingsReducer(INITIAL_SETTINGS_STATE, { type: 'loadSucceeded', response }))
    expect(s.modelDraft).toBe(expected)
    expect(s.base.model).toBe(expected)
  })

  it('TC-ST-051: T-08 saveSucceeded → modelDraft = response.model (모델만 저장해도 같다, D-ST-13)', () => {
    const saving = ready({ modelDraft: 'flash', isSaving: true })
    const response: CharacterSettingsResponse = { ...SAVED_RESPONSE, version: 4, updatedAt: SAVED_AT + 60000, model: 'flash' }
    const s = asReady(settingsReducer(saving, { type: 'saveSucceeded', response }))
    expect(s.modelDraft).toBe('flash')
    expect(s.base).toBe(response)
    expect(s.isSaving).toBe(false)
    expect(hasUnsavedChanges(s)).toBe(false)
  })

  it('TC-ST-051: T-11 modelChanged — ready·!isSaving 반영, 같은 값이면 같은 참조, 나머지 필드 참조 유지', () => {
    const prev = ready()
    const next = asReady(settingsReducer(prev, { type: 'modelChanged', value: 'flash' }))
    expect(next.modelDraft).toBe('flash')
    expect(next.draft).toBe(prev.draft)
    expect(next.base).toBe(prev.base)
    expect(settingsReducer(prev, { type: 'modelChanged', value: 'pro' })).toBe(prev)
    const unset = ready({ base: UNSET_RESPONSE, modelDraft: null })
    expect(asReady(settingsReducer(unset, { type: 'modelChanged', value: 'pro' })).modelDraft).toBe('pro')
  })

  it('TC-ST-051: T-11 stale 에서도 반영(입력 계속 가능, 저장만 막힘)', () => {
    const stale = ready({ isStale: true })
    const next = asReady(settingsReducer(stale, { type: 'modelChanged', value: 'flash' }))
    expect(next.modelDraft).toBe('flash')
    expect(next.isStale).toBe(true)
  })

  it('TC-ST-047: (리듀서) 저장 중 modelChanged → 같은 참조(무시) · loading·error 에서도 같은 참조', () => {
    const saving = ready({ isSaving: true })
    expect(settingsReducer(saving, { type: 'modelChanged', value: 'flash' })).toBe(saving)
    expect(settingsReducer(INITIAL_SETTINGS_STATE, { type: 'modelChanged', value: 'flash' })).toBe(INITIAL_SETTINGS_STATE)
    const err = deepFreeze<SettingsState>({ phase: 'error', error: { code: 'NETWORK', message: '' } })
    expect(settingsReducer(err, { type: 'modelChanged', value: 'flash' })).toBe(err)
  })

  it('TC-ST-051: T-05 reverted → modelDraft = base.model (pro 기준 · null 기준)', () => {
    expect(asReady(settingsReducer(ready({ modelDraft: 'flash' }), { type: 'reverted' })).modelDraft).toBe('pro')
    const unset = ready({ base: UNSET_RESPONSE, modelDraft: 'pro' })
    expect(asReady(settingsReducer(unset, { type: 'reverted' })).modelDraft).toBeNull()
    const both = asReady(settingsReducer(ready({ draft: bodyDirty(), modelDraft: 'flash' }), { type: 'reverted' }))
    expect([both.modelDraft, both.draft]).toEqual(['pro', baseDraft()])
  })

  it('TC-ST-051: T-06 imported · T-09 saveFailed · T-10 staleEntered → modelDraft 유지', () => {
    const changed = ready({ modelDraft: 'flash' })
    const imported = asReady(settingsReducer(changed, { type: 'imported', patch: { world: '가져온 세계', characters: {} } }))
    expect([imported.modelDraft, imported.draft.world]).toEqual(['flash', '가져온 세계'])
    const saving = ready({ modelDraft: 'flash', isSaving: true })
    expect(asReady(settingsReducer(saving, { type: 'saveFailed' })).modelDraft).toBe('flash')
    const stale = asReady(settingsReducer(saving, { type: 'staleEntered' }))
    expect([stale.modelDraft, stale.isStale]).toEqual(['flash', true])
  })
})

describe('TC-ST-051: 파생 — S-16 hasUnsavedChanges · S-11 · S-12 · S-14 · S-17 modelToSave', () => {
  it.each<[string, Partial<ReadyState>, boolean]>([
    ['본체 같음 · 모델 같음', {}, false],
    ['본체 같음 · 모델 다름', { modelDraft: 'flash' }, true],
    ['본체 다름 · 모델 같음', { draft: bodyDirty() }, true],
    ['본체 다름 · 모델 다름', { draft: bodyDirty(), modelDraft: 'flash' }, true],
  ])('TC-ST-051: S-16 %s → %s', (_, over, expected) => {
    expect(hasUnsavedChanges(ready(over))).toBe(expected)
  })

  it('TC-ST-051: S-16 null 기준 — 초안 null = 같음, 초안 pro = 다름', () => {
    expect(hasUnsavedChanges(ready({ base: UNSET_RESPONSE, modelDraft: null }))).toBe(false)
    expect(hasUnsavedChanges(ready({ base: UNSET_RESPONSE, modelDraft: 'pro' }))).toBe(true)
  })

  it('TC-ST-051: 모델만 dirty → S-11 저장 true · S-12 되돌리기 true · S-14 dirty / 저장 중·stale·본체 위반이면 저장 false', () => {
    const modelOnly = ready({ modelDraft: 'flash' })
    expect(canSaveSettings(modelOnly)).toBe(true)
    expect(canRevertSettings(modelOnly)).toBe(true)
    expect(statusOf(modelOnly)).toEqual({ kind: 'dirty' })
    expect(canSaveSettings(ready({ modelDraft: 'flash', isSaving: true }))).toBe(false)
    expect(canSaveSettings(ready({ modelDraft: 'flash', isStale: true }))).toBe(false)
    expect(canSaveSettings(ready({ modelDraft: 'flash', draft: bodyInvalid() }))).toBe(false)
    expect(statusOf(ready({ modelDraft: 'flash', isStale: true }))).toEqual({ kind: 'stale' })
  })

  it('TC-ST-051: S-17 modelToSave — 기준값과 다를 때만 키, 같으면 undefined(null 은 보내지 않음)', () => {
    expect(modelToSave(ready())).toBeUndefined()
    expect(modelToSave(ready({ modelDraft: 'flash' }))).toBe('flash')
    expect(modelToSave(ready({ draft: bodyDirty() }))).toBeUndefined()
    expect(modelToSave(ready({ base: UNSET_RESPONSE, modelDraft: null }))).toBeUndefined()
    expect(modelToSave(ready({ base: UNSET_RESPONSE, modelDraft: 'pro' }))).toBe('pro')
    expect(modelToSave(ready({ base: FLASH_RESPONSE, modelDraft: 'flash' }))).toBeUndefined()
  })
})

describe('TC-ST-051: 파일 경계 M-1 — 내보내기 입력에 모델 자리 없음 (R-SET-007 개정)', () => {
  it('TC-ST-051: toExportFile 에 model 을 섞으면 타입 오류(@ts-expect-error) · 출력 문자열에 model·pro·flash 0건', () => {
    const now = new Date(2026, 9, 8, 9, 0)
    // @ts-expect-error — SF-01 입력은 CharacterSettings 뿐(state.md §2.6 M-1). 모델 자리가 생기면 tsc 가 이 줄을 미사용 지시문으로 알린다
    const file = toExportFile({ world: BASE_SETTINGS.world, characters: BASE_SETTINGS.characters, model: 'flash' }, now)
    const text = serializeExportFile(file)
    expect(text).not.toMatch(/model|"pro"|"flash"/)
    expect(serializeExportFile(toExportFile(withCharField(BASE_SETTINGS, 'ciel', 'speech', '반말'), now))).not.toMatch(/model/)
  })
})
