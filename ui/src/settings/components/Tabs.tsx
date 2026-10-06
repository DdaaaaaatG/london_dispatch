/**
 * Tabs — 설계 settings/design/components.md §3.2 · a11y.md §1 · §3 · 요구 R-SET-009 (settings 로컬, 공용 승격 후보)
 * role=tablist 안 탭 버튼 n개. 로빙 tabindex(선택한 탭만 0). ←/→ 순환 · Home/End, 이동한 탭을 바로 선택하고 포커스한다.
 * `!` 표시가 있으면 접근성 이름 뒤에 issueSuffix 를 붙인다(색만으로 전하지 않는다). 문구는 props 로만 받는다.
 */
import type { KeyboardEvent } from 'react'
import { cx } from '@/components/utils/cx'
import styles from './Tabs.module.css'

export type TabItem<T extends string> = { id: T; label: string; hasIssue: boolean }

export type TabsProps<T extends string> = {
  items: readonly TabItem<T>[]
  activeId: T
  onSelect: (id: T) => void
  /** tablist 이름 */
  ariaLabel: string
  /** 탭 id = `${idPrefix}-tab-${id}`, 패널 id = `${idPrefix}-panel` */
  idPrefix: string
  /** hasIssue 일 때 접근성 이름 뒤에 붙는 말 */
  issueSuffix: string
}

export const tabDomId = (idPrefix: string, id: string): string => `${idPrefix}-tab-${id}`
export const panelDomId = (idPrefix: string): string => `${idPrefix}-panel`

/** 키에 맞는 다음 탭 위치. 해당 키가 아니면 null */
const targetIndex = (key: string, index: number, count: number): number | null => {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** 같은 tablist 안 index 번째 탭으로 포커스를 옮긴다 */
const focusTabAt = (from: HTMLElement, index: number): void => {
  const tabs = from.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[index]?.focus()
}

export const Tabs = <T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel,
  idPrefix,
  issueSuffix,
}: TabsProps<T>) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const target = targetIndex(event.key, index, items.length)
    const next = target === null ? undefined : items[target]
    if (target === null || next === undefined) return
    event.preventDefault()
    onSelect(next.id)
    focusTabAt(event.currentTarget, target)
  }

  return (
    <div className={styles.root} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={tabDomId(idPrefix, item.id)}
            className={cx(styles.tab, isActive && styles.selected)}
            aria-selected={isActive}
            aria-controls={panelDomId(idPrefix)}
            aria-label={item.hasIssue ? `${item.label}${issueSuffix}` : item.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={event => handleKeyDown(event, index)}
          >
            {item.label}
            {item.hasIssue && (
              <span className={styles.issue} aria-hidden="true">
                !
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
