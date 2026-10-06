/**
 * useSettingsUi — 설계 settings/design/state.md §1(화면 로컬 상태) · functions.md F-ST-06 · F-ST-12 · F-ST-18 · F-ST-19 · a11y.md §2.5 · §2.6
 * 요구: R-SET-009 · R-SET-007 · R-SET-008
 * 보이는 탭(activeTab, 처음 world) · 열린 시트(sheet, 처음 none) · 포커스 대상 ref 와 포커스 이동 effect 를 소유한다. 초안·요청은 모른다.
 * 탭 기억·시트 기억은 하지 않는다(요구 없음). 저장소·토큰을 읽지 않는다.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ToastProps } from '@/components/ui/Toast'
import { isDraftDirty } from '@/state/settings'
import type { SettingsState, SettingsTab } from '@/state/settings'
import type { FocusTarget } from './useSettingsEditor'

export type SettingsSheet = 'none' | 'fileMenu' | 'export' | 'import' | 'leave'

export type UseSettingsUiOptions = {
  state: SettingsState
  /** 저장 응답 뒤 포커스 대상 예약(useSettingsEditor 가 적는다) */
  focusTargetRef: RefObject<FocusTarget | null>
  onLeave: (notice?: ToastProps) => void
}

type FocusRefs = {
  titleRef: RefObject<HTMLHeadingElement | null>
  saveButtonRef: RefObject<HTMLButtonElement | null>
  fileMenuButtonRef: RefObject<HTMLButtonElement | null>
  backButtonRef: RefObject<HTMLButtonElement | null>
}

/**
 * 저장 클릭 뒤 포커스(a11y §2.6): 저장 중에는 「저장」이 비활성이라 포커스가 빠진다.
 * 성공·stale → h1, 그 밖 실패 → 다시 활성이 된 「저장」. 상태가 커밋된 뒤(layout effect)에 옮긴다.
 */
const useSaveFocus = (
  state: SettingsState,
  focusTargetRef: RefObject<FocusTarget | null>,
  { titleRef, saveButtonRef }: FocusRefs,
): void => {
  useLayoutEffect(() => {
    const target = focusTargetRef.current
    if (target === null) return
    focusTargetRef.current = null
    const element = target === 'title' ? titleRef.current : saveButtonRef.current
    element?.focus()
  }, [state, focusTargetRef, titleRef, saveButtonRef])
}

/**
 * 시트 닫힘 포커스 복귀의 2차(대체) 경로(F-ST-12): 1차는 공용 BottomSheet 가 열기 전 요소로 돌려준다.
 * 닫힌 커밋에서 포커스가 body 에 있으면(열기 전 포커스를 못 잡는 브라우저 등) ①②③ 은 ⋯, ④ 는 ‹ 로 옮긴다.
 */
const useSheetFocusReturn = (
  sheet: SettingsSheet,
  { fileMenuButtonRef, backButtonRef }: FocusRefs,
): void => {
  const previousRef = useRef<SettingsSheet>('none')
  useLayoutEffect(() => {
    const previous = previousRef.current
    previousRef.current = sheet
    if (sheet !== 'none' || previous === 'none') return
    const active = document.activeElement
    if (active !== null && active !== document.body) return
    const target = previous === 'leave' ? backButtonRef : fileMenuButtonRef
    target.current?.focus()
  }, [sheet, fileMenuButtonRef, backButtonRef])
}

export const useSettingsUi = ({ state, focusTargetRef, onLeave }: UseSettingsUiOptions) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('world')
  const [sheet, setSheet] = useState<SettingsSheet>('none')
  const refs: FocusRefs = {
    titleRef: useRef<HTMLHeadingElement>(null),
    saveButtonRef: useRef<HTMLButtonElement>(null),
    fileMenuButtonRef: useRef<HTMLButtonElement>(null),
    backButtonRef: useRef<HTMLButtonElement>(null),
  }
  useSaveFocus(state, focusTargetRef, refs)
  useSheetFocusReturn(sheet, refs)

  /** F-ST-18: 저장하지 않은 변경이 있으면(stale 포함) ④ 확인, 없으면 바로 나간다 */
  const requestBack = (): void => {
    const isDirty = state.phase === 'ready' && isDraftDirty(state.draft, state.base.settings)
    if (isDirty) setSheet('leave')
    else onLeave()
  }

  return {
    ...refs,
    activeTab,
    selectTab: setActiveTab,
    sheet,
    openFileMenu: () => setSheet('fileMenu'),
    openExport: () => setSheet('export'),
    openImport: () => setSheet('import'),
    closeSheet: () => setSheet('none'),
    requestBack,
    /** ④ 「나가기」: 초안을 버리고 rooms 로 간다 */
    confirmLeave: () => onLeave(),
  }
}
