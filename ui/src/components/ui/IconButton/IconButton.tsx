/**
 * 공용 IconButton — 설계 rooms/design/components.md §1.3 · 요구 R-CHAT-001 · R-CHAT-013
 * 인라인 SVG(stroke 1.25, aria-hidden). 접근성 이름은 필수 ariaLabel(화면 labels.ts)이 준다.
 * S2: more(⋯ 가로 점 3개) 추가, isDisabled 추가(chat ⋯ 를 쓰기 대기 중 비활성, chat design §11.2 D-10).
 */
import type { Ref } from 'react'
import styles from './IconButton.module.css'

export type IconButtonProps = {
  icon: 'back' | 'more'
  ariaLabel: string
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement> | undefined
  isDisabled?: boolean
}

const BACK_PATH = 'M15 5l-7 7 7 7'
const MORE_DOT_X = [6, 12, 18] as const

/** 아이콘 모양. back 은 선(stroke), more 는 채운 점 3개(stroke 없음) */
const IconShape = ({ icon }: { icon: IconButtonProps['icon'] }) =>
  icon === 'back' ? (
    <path d={BACK_PATH} />
  ) : (
    <>
      {MORE_DOT_X.map(x => (
        <circle key={x} cx={x} cy={12} r={1.5} fill="currentColor" stroke="none" />
      ))}
    </>
  )

export const IconButton = ({
  icon,
  ariaLabel,
  onClick,
  buttonRef,
  isDisabled = false,
}: IconButtonProps) => (
  <button
    type="button"
    ref={buttonRef}
    className={styles.root}
    aria-label={ariaLabel}
    disabled={isDisabled}
    onClick={() => onClick()}
  >
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <IconShape icon={icon} />
    </svg>
  </button>
)
