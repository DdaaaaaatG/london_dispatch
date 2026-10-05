/**
 * 공용 Button — 설계 rooms/design/components.md §1.2 · 요구 R-ROOMS-003 · R-CHAT-003
 * 문구를 갖지 않는다(children·ariaLabel 은 화면 labels.ts 에서 받는다).
 */
import type { ReactNode } from 'react'
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
}

export const Button = ({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  isDisabled = false,
  ariaLabel,
}: ButtonProps) => (
  <button
    type="button"
    className={cx(styles.root, styles[variant], styles[size])}
    disabled={isDisabled}
    aria-label={ariaLabel}
    onClick={() => onClick()}
  >
    {children}
  </button>
)
