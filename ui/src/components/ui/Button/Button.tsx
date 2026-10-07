/**
 * 공용 Button — 설계 rooms/design/components.md §1.2 · 요구 R-ROOMS-002 · R-ROOMS-003 · R-CHAT-003
 * 문구를 갖지 않는다(children·ariaLabel 은 화면 labels.ts 에서 받는다).
 * 후작업(2026-10-07): ariaDescribedBy(잠금 안내 연결) 추가.
 * S2: buttonRef 추가(포커스 복귀 대상 — 「+ 새 방」·ConfirmDialog 취소). 클래스 키는 variant·size 값 그대로(danger 포함).
 */
import type { ReactNode, Ref } from 'react'
import { cx } from '@/components/utils/cx'
import styles from './Button.module.css'

export type ButtonProps = {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isDisabled?: boolean
  /** 보이는 글자와 다를 때만 */
  ariaLabel?: string
  /** 포커스 복귀 대상. button 요소에 그대로 건다 */
  buttonRef?: Ref<HTMLButtonElement> | undefined
  /** 숨은 안내 요소 id(aria-describedby) */
  ariaDescribedBy?: string | undefined
}

export const Button = ({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  isDisabled = false,
  ariaLabel,
  buttonRef,
  ariaDescribedBy,
}: ButtonProps) => (
  <button
    type="button"
    ref={buttonRef}
    className={cx(styles.root, styles[variant], styles[size])}
    disabled={isDisabled}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    onClick={() => onClick()}
  >
    {children}
  </button>
)
