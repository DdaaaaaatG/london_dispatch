/**
 * 공용 IconButton — 설계 rooms/design/components.md §1.3 · 요구 R-CHAT-001 · R-CHAT-013 · R-SET-009
 * 인라인 SVG(stroke 1.25, aria-hidden). 접근성 이름은 필수 ariaLabel(화면 labels.ts)이 준다.
 * S2: more(⋯ 가로 점 3개) 추가, isDisabled 추가(chat ⋯ 를 쓰기 대기 중 비활성, chat design §11.2 D-10).
 * S3c: settings(톱니: 안쪽 원 r3 · 바깥 원 r6.5 · 톱니 선 8개) 추가 — rooms 상단 바 ⚙.
 */
import type { Ref } from 'react'
import styles from './IconButton.module.css'

export type IconButtonProps = {
  icon: 'back' | 'more' | 'settings'
  ariaLabel: string
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement> | undefined
  isDisabled?: boolean
}

const BACK_PATH = 'M15 5l-7 7 7 7'
const MORE_DOT_X = [6, 12, 18] as const
/** 중심에서 반지름 6.5 → 9 짧은 선 8개(0° · 45° · … · 315°) */
const GEAR_TEETH_PATH =
  'M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8 M5.6 18.4l1.8-1.8 M16.6 7.4l1.8-1.8'

/** 아이콘 모양. back · settings 는 선(stroke), more 는 채운 점 3개(stroke 없음) */
const IconShape = ({ icon }: { icon: IconButtonProps['icon'] }) => {
  if (icon === 'back') return <path d={BACK_PATH} />
  if (icon === 'settings') {
    return (
      <>
        <circle cx={12} cy={12} r={3} />
        <circle cx={12} cy={12} r={6.5} />
        <path d={GEAR_TEETH_PATH} />
      </>
    )
  }
  return (
    <>
      {MORE_DOT_X.map(x => (
        <circle key={x} cx={x} cy={12} r={1.5} fill="currentColor" stroke="none" />
      ))}
    </>
  )
}

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
