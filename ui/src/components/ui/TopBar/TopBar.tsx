/**
 * 공용 TopBar — 설계 rooms/design/components.md §1.1 · 요구 R-ROOMS-005 · R-CHAT-001 · R-CHAT-013
 * 렌더: <header> 44px. left → title(h1) → subtitle(time) → right 순서. 값이 없는 슬롯은 렌더하지 않는다.
 * 토큰 분기는 호출 쪽이 right 를 넘기지 않는 것으로 한다(미렌더, 숨김 금지).
 */
import type { ReactNode, Ref } from 'react'
import { cx } from '@/components/utils/cx'
import styles from './TopBar.module.css'

export type TopBarProps = {
  /** 한 줄 말줄임. h1(tabIndex -1)으로 렌더 */
  title: string
  /** 오른쪽 작은 날짜. time 요소 */
  subtitle?: { text: string; dateTime: string; ariaLabel: string }
  /** 뒤로 버튼 자리 */
  left?: ReactNode
  /** 메뉴·새 방 버튼 자리 */
  right?: ReactNode
  /** 포커스 이동용 */
  titleRef?: Ref<HTMLHeadingElement>
  variant?: 'screen' | 'room'
}

export const TopBar = ({
  title,
  subtitle,
  left,
  right,
  titleRef,
  variant = 'screen',
}: TopBarProps) => (
  <header className={styles.root}>
    {left && <div className={styles.left}>{left}</div>}
    <h1 ref={titleRef} tabIndex={-1} className={cx(styles.title, styles[variant])}>
      {title}
    </h1>
    {subtitle && (
      <time
        className={styles.subtitle}
        dateTime={subtitle.dateTime}
        aria-label={subtitle.ariaLabel}
      >
        {subtitle.text}
      </time>
    )}
    {right && <div className={styles.right}>{right}</div>}
  </header>
)
