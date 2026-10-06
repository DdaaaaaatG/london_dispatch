/**
 * useSettingsEditor — 설계 settings/design/functions.md §1 · F-ST-02 ~ F-ST-05 · F-ST-09 · F-ST-10 (함수 50줄 한계 때문에 읽기·저장 훅으로 나눴다)
 * 요구: R-SET-004 · R-SET-005 · R-SET-009 · R-SET-010 · R-SET-011 · R-CHAT-011 · R-SET-001
 * 리듀서(ui/src/state/settings.ts)·설정 읽기·저장·실패 분기·언마운트 뒤 응답 무시를 소유한다. 전이 규칙은 리듀서에만 있다.
 * 요청은 @/api 래퍼만 부른다(Authorization 헤더는 래퍼가 붙인다 — 화면은 토큰을 모른다). 래퍼는 throw 하지 않는다.
 * 콜백·상태는 latestRef 로 읽는다(매 렌더 layout effect 로 갱신) — 요청 함수 identity 가 렌더마다 바뀌지 않는다.
 */
import { useCallback, useLayoutEffect, useReducer, useRef } from 'react'
import type { Dispatch, RefObject } from 'react'
import { type ApiError, getCharacterSettings, isAuthFailure, saveCharacterSettings } from '@/api'
import type { ToastProps, ToastTone } from '@/components/ui/Toast'
import {
  INITIAL_SETTINGS_STATE,
  canSaveSettings,
  precheckDraft,
  settingsReducer,
} from '@/state/settings'
import type { SettingsAction, SettingsState } from '@/state/settings'
import { toastToneOf } from '@/state/writeFailure'
import { labels } from './labels'

/** 저장 응답이 커밋된 뒤 포커스를 받을 곳(화면 layout effect 가 읽고 비운다) */
export type FocusTarget = 'title' | 'save'

export type UseSettingsEditorOptions = {
  /** 인증 3코드(열기·저장) — App 이 읽기 전용으로 전환한다 */
  onAuthFailure: () => void
  /** OWNER_ONLY(열기·저장) — App 이 isOwner 를 내린다 */
  onOwnerLost: () => void
  onLeave: (notice?: ToastProps) => void
  showToast: (message: string, tone: ToastTone) => void
}

export type UseSettingsEditorResult = {
  state: SettingsState
  /** 편집·되돌리기·가져오기 액션은 화면이 바로 보낸다 */
  dispatch: Dispatch<SettingsAction>
  loadSettings: () => Promise<void>
  retryLoad: () => void
  saveSettings: () => Promise<void>
  focusTargetRef: RefObject<FocusTarget | null>
}

type Latest = { state: SettingsState; options: UseSettingsEditorOptions }
type EditorRefs = {
  dispatch: Dispatch<SettingsAction>
  isActiveRef: RefObject<boolean>
  latestRef: RefObject<Latest>
}

/** F-ST-03 · F-ST-04 · F-ST-05: 읽기·다시 시도·열기 실패 분기 */
const useLoadActions = ({ dispatch, isActiveRef, latestRef }: EditorRefs) => {
  /** OWNER_ONLY 먼저(인증 3코드가 아니다) → 인증 3코드 → 그 밖은 화면 안 오류 판 */
  const handleLoadFailure = useCallback(
    (error: ApiError): void => {
      const { onAuthFailure, onOwnerLost, onLeave } = latestRef.current.options
      if (error.code === 'OWNER_ONLY') {
        onOwnerLost()
        onLeave({ message: labels.ownerOnly, tone: 'warning' })
      } else if (isAuthFailure(error)) {
        onAuthFailure()
        onLeave({ message: labels.authText(error.code), tone: 'warning' })
      } else {
        dispatch({ type: 'loadFailed', error })
      }
    },
    [dispatch, latestRef],
  )

  /** 설정 화면에 들어올 때마다 다시 읽는다(App 판정 응답은 쓰지 않는다 — 판정과 진입 사이에 바뀌었을 수 있다) */
  const loadSettings = useCallback(async (): Promise<void> => {
    const result = await getCharacterSettings()
    if (!isActiveRef.current) return
    if (result.ok) dispatch({ type: 'loadSucceeded', response: result.value })
    else handleLoadFailure(result.error)
  }, [dispatch, isActiveRef, handleLoadFailure])

  const retryLoad = useCallback((): void => {
    dispatch({ type: 'loadStarted' })
    void loadSettings()
  }, [dispatch, loadSettings])

  return { loadSettings, retryLoad }
}

/** F-ST-09 · F-ST-10: 저장과 실패 분기. 포커스 이동은 화면 layout effect 가 focusTargetRef 를 읽어 한다 */
const useSaveAction = (
  { dispatch, isActiveRef, latestRef }: EditorRefs,
  focusTargetRef: RefObject<FocusTarget | null>,
) => {
  /** OWNER_ONLY → rooms(초안 버림) · 인증 3코드 → stale(초안 보존, 토스트 없음) · 그 밖 → 토스트 */
  const handleSaveFailure = useCallback(
    (error: ApiError): void => {
      const { onAuthFailure, onOwnerLost, onLeave, showToast } = latestRef.current.options
      if (error.code === 'OWNER_ONLY') {
        onOwnerLost()
        onLeave({ message: labels.ownerOnly, tone: 'warning' })
        return
      }
      if (isAuthFailure(error)) {
        onAuthFailure()
        focusTargetRef.current = 'title'
        dispatch({ type: 'staleEntered' })
        return
      }
      focusTargetRef.current = 'save'
      dispatch({ type: 'saveFailed' })
      showToast(labels.saveErrorText(error), toastToneOf(error))
    },
    [dispatch, latestRef, focusTargetRef],
  )

  const saveInFlightRef = useRef(false)
  /** 저장 본문 = 사전 검사를 통과한 정규화 값. 같은 틱 연타는 saveInFlightRef 가 막는다 */
  return useCallback(async (): Promise<void> => {
    const current = latestRef.current.state
    if (saveInFlightRef.current || current.phase !== 'ready' || !canSaveSettings(current)) return
    const check = precheckDraft(current.draft)
    if (!check.ok) return
    saveInFlightRef.current = true
    dispatch({ type: 'saveStarted' })
    const result = await saveCharacterSettings(check.value)
    saveInFlightRef.current = false
    if (!isActiveRef.current) return
    if (!result.ok) {
      handleSaveFailure(result.error)
      return
    }
    focusTargetRef.current = 'title'
    dispatch({ type: 'saveSucceeded', response: result.value })
    latestRef.current.options.showToast(labels.saved, 'success')
  }, [dispatch, isActiveRef, latestRef, focusTargetRef, handleSaveFailure])
}

export const useSettingsEditor = (options: UseSettingsEditorOptions): UseSettingsEditorResult => {
  const [state, dispatch] = useReducer(settingsReducer, INITIAL_SETTINGS_STATE)
  const isActiveRef = useRef(false)
  const focusTargetRef = useRef<FocusTarget | null>(null)
  const latestRef = useRef<Latest>({ state, options })

  useLayoutEffect(() => {
    latestRef.current = { state, options }
  })
  // 언마운트 뒤에 도착한 응답을 버리기 위한 활성 플래그
  useLayoutEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])

  const refs = { dispatch, isActiveRef, latestRef }
  const { loadSettings, retryLoad } = useLoadActions(refs)
  const saveSettings = useSaveAction(refs, focusTargetRef)
  return { state, dispatch, loadSettings, retryLoad, saveSettings, focusTargetRef }
}
