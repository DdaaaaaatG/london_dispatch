/**
 * 공용 Toggle — 설계 rooms/design/components.md §1.14 · 요구 R-CHAT-004
 * role=switch 버튼. 상태는 색 + 글자(onLabel · offLabel)로 전하고 aria-checked 가 상태를 말한다.
 * 부품은 상태를 바꾸지 않는다: 클릭·Space·Enter 는 onChange(!isOn) 를 부를 뿐이다. 문구는 호출 쪽(labels.ts)이 정한다.
 */
import { cx } from '@/components/utils/cx'
import styles from './Toggle.module.css'

export type ToggleProps = {
  isOn: boolean
  onChange: (next: boolean) => void
  /** 켜짐일 때 보이는 글자 */
  onLabel: string
  /** 꺼짐일 때 보이는 글자 */
  offLabel: string
  /** 스위치 이름(상태는 aria-checked 가 말한다) */
  ariaLabel: string
}

export const Toggle = ({ isOn, onChange, onLabel, offLabel, ariaLabel }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={isOn}
    aria-label={ariaLabel}
    className={cx(styles.root, isOn && styles.on)}
    onClick={() => onChange(!isOn)}
  >
    {isOn ? onLabel : offLabel}
  </button>
)
