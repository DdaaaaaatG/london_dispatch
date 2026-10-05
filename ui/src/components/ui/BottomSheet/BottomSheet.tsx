/**
 * 공용 BottomSheet — 설계 rooms/design/components.md §1.15 · 요구 R-CHAT-001 · R-CHAT-007 · R-CHAT-013
 * 비유: 화면 위에 반투명 천을 덮고, 아래에서 쟁반을 밀어 올린다. 쟁반을 내려놓기 전에는 천 아래를 만질 수 없다.
 * 포털 없음: 덮개는 시트를 쓰는 화면 루트(position: relative) 안에 놓인다. 덮개 클릭·Esc 는 onClose(요청 중이면 무시).
 * 포커스: 열릴 때 initialFocusRef 또는 첫 포커스 가능 요소로, 닫힐 때 열기 전 요소(DOM 에 있을 때만)로 되돌린다. Tab 은 패널 안에서 순환한다.
 * 문구를 갖지 않는다(ariaLabel·header·children 은 호출 쪽이 정한다).
 */
import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import styles from './BottomSheet.module.css'

export type BottomSheetProps = {
  ariaLabel: string
  /** 기본 'dialog'. 파괴 확인은 'alertdialog' */
  role?: 'dialog' | 'alertdialog' | undefined
  /** 머리 줄(40px). 없으면 렌더하지 않는다 */
  header?: ReactNode
  children: ReactNode
  /** Esc · 덮개 탭 */
  onClose: () => void
  /** true 면 Esc·덮개로 닫히지 않는다(요청 중) */
  isDismissDisabled?: boolean | undefined
  /** 없으면 시트 안 첫 포커스 가능 요소 */
  initialFocusRef?: RefObject<HTMLElement | null> | undefined
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'

const focusableIn = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))

/** Tab · Shift+Tab 이 패널 밖으로 나가지 않게 처음 ↔ 끝을 잇는다 */
const trapTab = (event: KeyboardEvent<HTMLElement>, panel: HTMLElement | null): void => {
  if (panel === null) return
  const items = focusableIn(panel)
  const first = items[0]
  const last = items[items.length - 1]
  if (first === undefined || last === undefined) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (!panel.contains(active)) {
    event.preventDefault()
    const entry = event.shiftKey ? last : first
    entry.focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * 열기 전 요소로 포커스를 되돌린다. 그 요소가 DOM 에 없으면 아무것도 하지 않는다.
 * 같은 커밋에서 아직 비활성이던 버튼(예: 쓰기 대기가 막 끝난 ⋯)은 바로는 포커스를 못 받으므로, 커밋이 끝난 뒤 한 번 더 시도한다
 * (그때까지 아무도 포커스를 가져가지 않았을 때만).
 */
const restoreFocus = (target: Element | null): void => {
  if (!(target instanceof HTMLElement) || target === document.body) return
  const apply = (): boolean => {
    if (!target.isConnected) return true
    target.focus()
    return document.activeElement === target
  }
  if (apply()) return
  queueMicrotask(() => {
    const active = document.activeElement
    if (active === null || active === document.body) apply()
  })
}

export const BottomSheet = ({
  ariaLabel,
  role = 'dialog',
  header,
  children,
  onClose,
  isDismissDisabled = false,
  initialFocusRef,
}: BottomSheetProps) => {
  const panelRef = useRef<HTMLDivElement>(null)

  // 열릴 때 포커스 이동, 닫힐 때(언마운트) 열기 전 요소로 복귀. 그 요소가 DOM 에 없으면 아무것도 하지 않는다
  useLayoutEffect(() => {
    const previous = document.activeElement
    const first = panelRef.current === null ? undefined : focusableIn(panelRef.current)[0]
    const target = initialFocusRef?.current ?? first
    target?.focus()
    return () => restoreFocus(previous)
  }, [initialFocusRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      trapTab(event, panelRef.current)
      return
    }
    if (event.key !== 'Escape' || isDismissDisabled) return
    event.stopPropagation()
    onClose()
  }

  return (
    <div
      className={styles.overlay}
      onClick={isDismissDisabled ? undefined : onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={event => event.stopPropagation()}
      >
        {header !== undefined && <div className={styles.header}>{header}</div>}
        {children}
      </div>
    </div>
  )
}
