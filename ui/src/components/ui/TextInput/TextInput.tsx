/**
 * 공용 TextInput — 설계 rooms/design/components.md §1.12 · 요구 R-ROOMS-002 · R-CHAT-001
 * 한 줄 입력. maxChars 가 있으면 오른쪽 안에 "n/max" 카운터(aria-hidden)를 보이고, 넘으면 over 클래스·aria-invalid 로 알린다.
 * Enter(IME 조합 중 제외)는 onEnter, Esc 는 onEscape 를 부른다. 요청 중에는 isReadOnly 로 편집만 막는다(포커스는 유지).
 * maxLength 속성은 쓰지 않는다(UTF-16 단위라 어긋나고 붙여넣기를 말없이 자른다). 문구는 props 로만 받는다(§1.9).
 */
import type { KeyboardEvent, Ref } from 'react'
import { isComposingKey } from '@/components/utils/ime'
import { cx } from '@/components/utils/cx'
import { countChars } from '@/state/limits'
import styles from './TextInput.module.css'

export type TextInputProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  /** 있으면 오른쪽 안에 `${글자 수}/${maxChars}` 카운터 */
  maxChars?: number
  inputRef?: Ref<HTMLInputElement>
  /** Enter(IME 조합 중 제외) → 기본 동작을 막고 호출 */
  onEnter?: () => void
  onEscape?: () => void
  /** 요청 중. 포커스는 유지하고 편집만 막는다 */
  isReadOnly?: boolean
}

export const TextInput = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  maxChars,
  inputRef,
  onEnter,
  onEscape,
  isReadOnly = false,
}: TextInputProps) => {
  const count = countChars(value)
  const isOver = maxChars !== undefined && count > maxChars

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      onEscape?.()
      return
    }
    if (event.key !== 'Enter' || onEnter === undefined || isComposingKey(event)) return
    event.preventDefault()
    onEnter()
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="text"
        className={cx(styles.input, maxChars !== undefined && styles.hasCounter)}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isOver ? true : undefined}
        autoComplete="off"
        readOnly={isReadOnly}
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {maxChars !== undefined && (
        <span className={cx(styles.counter, isOver && styles.over)} aria-hidden="true">
          {`${count}/${maxChars}`}
        </span>
      )}
    </div>
  )
}
