/**
 * 캐릭터 설정 화면 상태 — 설계 settings/design/state.md §2 · 요구 R-SET-009 · R-SET-002 · R-SET-005 · R-SET-011 · R-SET-013
 * 비유: 초안은 연필로 쓴 원고, 기준값은 마지막으로 인쇄해 둔 원고다. 되돌리기는 연필 원고를 지우고 인쇄본을 다시 베껴 쓰는 것이다.
 * 순수 TS(React·DOM 없음). 입력을 바꾸지 않고 새 객체만 만든다. 검사 규칙은 @shared/settings 단일 소스(서버 400 과 같은 문구).
 */
import { countCodePoints, normalizeText } from '@shared/limits'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  WORLD_FIELD_SPEC,
  checkCharacterSettings,
} from '@shared/settings'
import type { ListFieldSpec, SettingsCheckResult, TextFieldSpec } from '@shared/settings'
import type {
  CharacterId,
  CharacterSettingFields,
  CharacterSettings,
  CharacterSettingsResponse,
  LlmModelKey,
} from '@shared/types'
import type { ApiError } from '@/api'

export type SettingsTab = 'world' | CharacterId
/** 탭 순서(메인 세션 결정). 처음 탭은 world */
export const SETTINGS_TABS: readonly SettingsTab[] = ['world', 'sebastian', 'ciel']

/** 초안 한 명분. 글 필드는 입력 그대로, 목록 필드는 "한 줄에 하나" 텍스트 그대로(trim 안 함) */
export type DraftCharacter = { readonly [K in keyof CharacterSettingFields]: string }
export type SettingsDraft = {
  readonly world: string
  readonly characters: Readonly<Record<CharacterId, DraftCharacter>>
}

/** 필드 하나의 위치 */
export type DraftFieldRef =
  | { readonly tab: 'world' }
  | { readonly tab: CharacterId; readonly key: keyof CharacterSettingFields }

/** 필드 하나의 문제(화면 안내용). 사전 검사(checkCharacterSettings)와 같은 spec 에서 나온다 */
export type FieldIssue =
  | { kind: 'required' }
  | { kind: 'tooLong'; max: number }
  | { kind: 'tooManyLines'; maxItems: number }
  | { kind: 'lineTooLong'; lineNo: number; itemMax: number }

/**
 * 가져오기 후보 위치의 값(후보 위치만). 검사 전에는 후보 값(정규화 전), 리듀서 imported 에는 검사 통과 값이 들어간다.
 * 글 필드는 string, 목록 필드는 string[] 만 든다(Partial<CharacterSettingFields> 가 이를 보장한다).
 */
export type SettingsPatch = {
  readonly world?: string
  readonly characters: Readonly<Partial<Record<CharacterId, Partial<CharacterSettingFields>>>>
}

export type SettingsState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly error: ApiError }
  | {
      readonly phase: 'ready'
      /** 마지막으로 읽거나 저장한 응답(기준값) */
      readonly base: CharacterSettingsResponse
      readonly draft: SettingsDraft
      /** (S3f) 모델 선택 초안. 본체 초안(SettingsDraft) 밖에 둔다(D-ST-12). null = 미선택 판 */
      readonly modelDraft: LlmModelKey | null
      readonly isSaving: boolean
      /** 저장 중 인증 실패 뒤. 되돌아가지 않는다(새로 고침만) */
      readonly isStale: boolean
    }

/** ready 판 하나(S-13 · S-14 입력) */
export type ReadyState = Extract<SettingsState, { phase: 'ready' }>

export type SettingsAction =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; response: CharacterSettingsResponse }
  | { type: 'loadFailed'; error: ApiError }
  | { type: 'worldChanged'; value: string }
  | {
      type: 'characterFieldChanged'
      id: CharacterId
      key: keyof CharacterSettingFields
      value: string
    }
  | { type: 'reverted' }
  | { type: 'imported'; patch: SettingsPatch }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; response: CharacterSettingsResponse }
  | { type: 'saveFailed' }
  | { type: 'staleEntered' }
  | { type: 'modelChanged'; value: LlmModelKey }

export const INITIAL_SETTINGS_STATE: SettingsState = { phase: 'loading' }

/** S-01: 저장값 → 목록 TextArea 글 */
export const listToLines = (items: readonly string[]): string => items.join('\n')

/** S-02: 줄마다 trim, 빈 줄 제거 */
export const linesToList = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(line => line !== '')

const toDraftCharacter = (f: CharacterSettingFields): DraftCharacter => ({
  sourceMaterial: f.sourceMaterial,
  age: f.age,
  gender: f.gender,
  role: f.role,
  persona: f.persona,
  personalityTags: f.personalityTags,
  appearance: f.appearance,
  relationships: f.relationships,
  speech: f.speech,
  sampleDialogue: listToLines(f.sampleDialogue),
  rules: listToLines(f.rules),
})

/** S-03: 저장값 → 초안(새 객체) */
export const draftFromSettings = (settings: CharacterSettings): SettingsDraft => ({
  world: settings.world,
  characters: {
    sebastian: toDraftCharacter(settings.characters.sebastian),
    ciel: toDraftCharacter(settings.characters.ciel),
  },
})

const toSettingsCharacter = (d: DraftCharacter): CharacterSettingFields => ({
  sourceMaterial: normalizeText(d.sourceMaterial),
  age: normalizeText(d.age),
  gender: normalizeText(d.gender),
  role: normalizeText(d.role),
  persona: normalizeText(d.persona),
  personalityTags: normalizeText(d.personalityTags),
  appearance: normalizeText(d.appearance),
  relationships: normalizeText(d.relationships),
  speech: normalizeText(d.speech),
  sampleDialogue: linesToList(d.sampleDialogue),
  rules: linesToList(d.rules),
})

/** S-04: 초안 → 정규화 값. 길이·개수 검사는 하지 않는다(dirty 비교·stale 내보내기 기준) */
export const normalizeDraft = (draft: SettingsDraft): CharacterSettings => ({
  world: normalizeText(draft.world),
  characters: {
    sebastian: toSettingsCharacter(draft.characters.sebastian),
    ciel: toSettingsCharacter(draft.characters.ciel),
  },
})

const fieldEqual = (a: string | string[], b: string | string[]): boolean => {
  if (typeof a === 'string' || typeof b === 'string') return a === b
  return a.length === b.length && a.every((item, index) => item === b[index])
}

const characterEqual = (a: CharacterSettingFields, b: CharacterSettingFields): boolean =>
  CHARACTER_FIELD_KEYS.every(key => fieldEqual(a[key], b[key]))

/** S-05: 키 순서와 무관하게 값만 비교한다(목록은 길이 + 항목별) */
export const settingsEqual = (a: CharacterSettings, b: CharacterSettings): boolean =>
  a.world === b.world &&
  characterEqual(a.characters.sebastian, b.characters.sebastian) &&
  characterEqual(a.characters.ciel, b.characters.ciel)

/** S-06: 기준값도 초안 왕복을 거쳐 비교한다. 공백만 바꾼 변경은 dirty 가 아니다 */
export const isDraftDirty = (draft: SettingsDraft, base: CharacterSettings): boolean =>
  !settingsEqual(normalizeDraft(draft), normalizeDraft(draftFromSettings(base)))

/** S-07: 사전 검사. 통과 값(정규화)이 저장 본문이다. 실패 문장은 서버 400 과 같다 */
export const precheckDraft = (draft: SettingsDraft): SettingsCheckResult =>
  checkCharacterSettings(normalizeDraft(draft))

const textIssueOf = (value: string, spec: TextFieldSpec): FieldIssue | null => {
  const count = countCodePoints(normalizeText(value))
  if (spec.required && count < 1) return { kind: 'required' }
  return count > spec.max ? { kind: 'tooLong', max: spec.max } : null
}

const listIssueOf = (value: string, spec: ListFieldSpec): FieldIssue | null => {
  const items = linesToList(value)
  if (items.length > spec.maxItems) return { kind: 'tooManyLines', maxItems: spec.maxItems }
  const index = items.findIndex(item => countCodePoints(item) > spec.itemMax)
  return index < 0 ? null : { kind: 'lineTooLong', lineNo: index + 1, itemMax: spec.itemMax }
}

/** S-08: 그 필드 하나만 검사한다. 같은 spec·같은 정규화라 precheckDraft 와 어긋나지 않는다 */
export const fieldIssueOf = (draft: SettingsDraft, ref: DraftFieldRef): FieldIssue | null => {
  if (ref.tab === 'world') return textIssueOf(draft.world, WORLD_FIELD_SPEC)
  const spec = CHARACTER_FIELD_SPECS[ref.key]
  const value = draft.characters[ref.tab][ref.key]
  return spec.kind === 'text' ? textIssueOf(value, spec) : listIssueOf(value, spec)
}

/** S-09: 탭 `!` 표시 */
export const tabHasIssue = (draft: SettingsDraft, tab: SettingsTab): boolean =>
  tab === 'world'
    ? fieldIssueOf(draft, { tab }) !== null
    : CHARACTER_FIELD_KEYS.some(key => fieldIssueOf(draft, { tab, key }) !== null)

export type FieldCount = { count: number; max: number; unit: 'chars' | 'lines' }

const charsCount = (value: string, max: number): FieldCount => ({
  count: countCodePoints(normalizeText(value)),
  max,
  unit: 'chars',
})

/** S-10: 라벨 줄 카운터용 */
export const fieldCount = (draft: SettingsDraft, ref: DraftFieldRef): FieldCount => {
  if (ref.tab === 'world') return charsCount(draft.world, WORLD_FIELD_SPEC.max)
  const spec = CHARACTER_FIELD_SPECS[ref.key]
  const value = draft.characters[ref.tab][ref.key]
  if (spec.kind === 'text') return charsCount(value, spec.max)
  return { count: linesToList(value).length, max: spec.maxItems, unit: 'lines' }
}

/** 저장 중도 stale 도 아닌 ready — 되돌리기·저장·가져오기 반영이 허용되는 상태 */
const isEditable = (state: SettingsState): state is ReadyState =>
  state.phase === 'ready' && !state.isSaving && !state.isStale

/** S-16(S3f): 미저장 변경 = 본체 dirty 또는 모델 선택이 기준값과 다름. 저장·되돌리기·하단 줄·이탈 확인이 쓴다 */
export const hasUnsavedChanges = (state: ReadyState): boolean =>
  isDraftDirty(state.draft, state.base.settings) || state.modelDraft !== state.base.model

/** S-17(S3f): 저장 둘째 인자. 기준값과 다를 때만 키, 같으면 undefined(서버 저장값 유지). null 은 보내지 않는다 */
export const modelToSave = (state: ReadyState): LlmModelKey | undefined =>
  state.modelDraft !== null && state.modelDraft !== state.base.model ? state.modelDraft : undefined

/** S-12: stale 에서는 비활성(메인 세션 결정) */
export const canRevertSettings = (state: SettingsState): boolean =>
  isEditable(state) && hasUnsavedChanges(state)

/** S-11: 미저장 변경(S-16) && 본체 사전 검사 통과 && !saving && !stale */
export const canSaveSettings = (state: SettingsState): boolean =>
  isEditable(state) && hasUnsavedChanges(state) && precheckDraft(state.draft).ok

/** S-13: 평소 기준값, stale 이면 정규화 초안(상한을 넘었어도 그대로 — 보관이 목적) */
export const exportTargetOf = (state: ReadyState): CharacterSettings =>
  state.isStale ? normalizeDraft(state.draft) : state.base.settings

export type SettingsStatus =
  | { kind: 'saving' }
  | { kind: 'stale' }
  | { kind: 'invalid'; message: string }
  | { kind: 'dirty' }
  | { kind: 'default' }
  | { kind: 'saved'; version: number; updatedAt: number }

/** S-14: 하단 줄 상태. saving > stale > invalid > dirty > default > saved */
export const statusOf = (state: ReadyState): SettingsStatus => {
  if (state.isSaving) return { kind: 'saving' }
  if (state.isStale) return { kind: 'stale' }
  if (hasUnsavedChanges(state)) {
    const check = precheckDraft(state.draft)
    return check.ok ? { kind: 'dirty' } : { kind: 'invalid', message: check.issue.message }
  }
  const { isDefault, updatedAt, version } = state.base
  return isDefault || updatedAt === null
    ? { kind: 'default' }
    : { kind: 'saved', version, updatedAt }
}

const patchCharacter = (
  base: CharacterSettingFields,
  patch: Partial<CharacterSettingFields> | undefined,
): CharacterSettingFields => (patch === undefined ? base : { ...base, ...patch })

/**
 * S-15: 가져오기 후보 검사. base(마지막으로 읽거나 저장한 값) 위에 patch 위치만 덮은 새 객체를 checkCharacterSettings 로 검사한다.
 * 위반은 늘 후보 필드에서 나온다(base 는 서버가 검증한 값). base·patch 는 바꾸지 않는다.
 */
export const checkPatchedSettings = (
  base: CharacterSettings,
  patch: SettingsPatch,
): SettingsCheckResult =>
  checkCharacterSettings({
    world: patch.world ?? base.world,
    characters: {
      sebastian: patchCharacter(base.characters.sebastian, patch.characters.sebastian),
      ciel: patchCharacter(base.characters.ciel, patch.characters.ciel),
    },
  })

const draftWithField = (
  draft: SettingsDraft,
  id: CharacterId,
  key: keyof CharacterSettingFields,
  value: string,
): SettingsDraft => ({
  world: draft.world,
  characters: { ...draft.characters, [id]: { ...draft.characters[id], [key]: value } },
})

/** patch 값 → 초안 문자열. 목록은 "한 줄에 하나" 글로 바꾼다. patch 에 없으면 현재 입력 그대로 */
const patchedText = (value: string | string[] | undefined, current: string): string => {
  if (value === undefined) return current
  return typeof value === 'string' ? value : listToLines(value)
}

const patchDraftCharacter = (
  cur: DraftCharacter,
  p: Partial<CharacterSettingFields> | undefined,
): DraftCharacter =>
  p === undefined
    ? cur
    : {
        sourceMaterial: patchedText(p.sourceMaterial, cur.sourceMaterial),
        age: patchedText(p.age, cur.age),
        gender: patchedText(p.gender, cur.gender),
        role: patchedText(p.role, cur.role),
        persona: patchedText(p.persona, cur.persona),
        personalityTags: patchedText(p.personalityTags, cur.personalityTags),
        appearance: patchedText(p.appearance, cur.appearance),
        relationships: patchedText(p.relationships, cur.relationships),
        speech: patchedText(p.speech, cur.speech),
        sampleDialogue: patchedText(p.sampleDialogue, cur.sampleDialogue),
        rules: patchedText(p.rules, cur.rules),
      }

const patchDraft = (draft: SettingsDraft, patch: SettingsPatch): SettingsDraft => ({
  world: patch.world ?? draft.world,
  characters: {
    sebastian: patchDraftCharacter(draft.characters.sebastian, patch.characters.sebastian),
    ciel: patchDraftCharacter(draft.characters.ciel, patch.characters.ciel),
  },
})

const reduceReady = (state: ReadyState, action: SettingsAction): SettingsState => {
  const canEdit = !state.isSaving && !state.isStale
  switch (action.type) {
    case 'worldChanged':
      return state.isSaving ? state : { ...state, draft: { ...state.draft, world: action.value } }
    case 'characterFieldChanged':
      return state.isSaving
        ? state
        : { ...state, draft: draftWithField(state.draft, action.id, action.key, action.value) }
    case 'reverted':
      return canEdit
        ? { ...state, draft: draftFromSettings(state.base.settings), modelDraft: state.base.model }
        : state
    case 'imported':
      return canEdit ? { ...state, draft: patchDraft(state.draft, action.patch) } : state
    case 'saveStarted':
      return canEdit ? { ...state, isSaving: true } : state
    case 'saveSucceeded':
      return state.isSaving
        ? {
            ...state,
            base: action.response,
            draft: draftFromSettings(action.response.settings),
            modelDraft: action.response.model,
            isSaving: false,
          }
        : state
    case 'saveFailed':
      return state.isSaving ? { ...state, isSaving: false } : state
    case 'staleEntered':
      return { ...state, isSaving: false, isStale: true }
    case 'modelChanged':
      return state.isSaving || state.modelDraft === action.value
        ? state
        : { ...state, modelDraft: action.value }
    default:
      return state
  }
}

/** loading 에서만 로드 결과를 받는다 */
const reduceLoading = (state: SettingsState, action: SettingsAction): SettingsState => {
  if (action.type === 'loadSucceeded') {
    const { response } = action
    return {
      phase: 'ready',
      base: response,
      draft: draftFromSettings(response.settings),
      modelDraft: response.model,
      isSaving: false,
      isStale: false,
    }
  }
  return action.type === 'loadFailed' ? { phase: 'error', error: action.error } : state
}

/**
 * 리듀서 T-01 ~ T-11. 새 객체만 만든다. 맞지 않는 상태·액션 조합은 같은 참조를 돌려준다(늦은 응답 방어).
 * 저장 중에는 편집을 무시하고, stale 에서는 되돌리기·가져오기·저장 시작을 무시한다.
 */
export const settingsReducer = (state: SettingsState, action: SettingsAction): SettingsState => {
  if (action.type === 'loadStarted') return INITIAL_SETTINGS_STATE
  if (state.phase === 'loading') return reduceLoading(state, action)
  return state.phase === 'ready' ? reduceReady(state, action) : state
}
