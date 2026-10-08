/**
 * 공용 TextInput — 설계 rooms/design/components.md §1.12 · 요구 R-ROOMS-002 · R-CHAT-001 · R-LOCK-001
 * 한 줄 입력. maxChars 가 있으면 오른쪽 안에 "n/max" 카운터(aria-hidden)를 보이고, 넘으면 over 클래스·aria-invalid 로 알린다.
 * Enter(IME 조합 중 제외)는 onEnter, Esc 는 onEscape 를 부른다. 요청 중에는 isReadOnly 로 편집만 막는다(포커스는 유지).
 * (S6) type='password' 이면 브라우저 저장 비밀번호 자동 채움·저장 제안을 막고(autocomplete=new-password · autocapitalize=off · spellcheck=false)
 * 카운터를 trim 없이 센다(lock.md D-L5 · D-L6). 보기 토글은 없다.
 * maxLength 속성은 쓰지 않는다(UTF-16 단위라 어긋나고 붙여넣기를 말없이 자른다). 문구는 props 로만 받는다(§1.9).
 */
import type { KeyboardEvent, Ref } from 'react'
import { isComposingKey } from '@/components/utils/ime'
import { cx } from '@/components/utils/cx'
import { countChars, countPasswordChars } from '@/state/limits'
import styles from './TextInput.module.css'

export type TextInputProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string | undefined
  /** 있으면 오른쪽 안에 `${글자 수}/${maxChars}` 카운터 */
  maxChars?: number
  inputRef?: Ref<HTMLInputElement>
  /** Enter(IME 조합 중 제외) → 기본 동작을 막고 호출 */
  onEnter?: () => void
  onEscape?: () => void
  /** 요청 중. 포커스는 유지하고 편집만 막는다 */
  isReadOnly?: boolean
  /** (S6) 기본 'text'. 'password' 면 자동 채움·저장 제안을 막고 카운터를 trim 없이 센다 */
  type?: 'text' | 'password' | undefined
}

/** Esc → onEscape, Enter(IME 조합 중 제외) → 기본 동작을 막고 onEnter */
const handleKeyDown = (
  event: KeyboardEvent<HTMLInputElement>,
  onEnter: (() => void) | undefined,
  onEscape: (() => void) | undefined,
): void => {
  if (event.key === 'Escape') {
    onEscape?.()
    return
  }
  if (event.key !== 'Enter' || onEnter === undefined || isComposingKey(event)) return
  event.preventDefault()
  onEnter()
}

/** 비밀번호 입력의 자동 대문자·맞춤법 검사를 끈다(저장 제안·자동 채움 차단은 autoComplete='new-password') */
const PASSWORD_ATTRIBUTES = { autoCapitalize: 'off', spellCheck: false } as const

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
  type = 'text',
}: TextInputProps) => {
  const isPassword = type === 'password'
  const count = isPassword ? countPasswordChars(value) : countChars(value)
  const isOver = maxChars !== undefined && count > maxChars

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type={type}
        className={cx(styles.input, maxChars !== undefined && styles.hasCounter)}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isOver ? true : undefined}
        autoComplete={isPassword ? 'new-password' : 'off'}
        {...(isPassword ? PASSWORD_ATTRIBUTES : undefined)}
        readOnly={isReadOnly}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => handleKeyDown(event, onEnter, onEscape)}
      />
      {maxChars !== undefined && (
        <span className={cx(styles.counter, isOver && styles.over)} aria-hidden="true">
          {`${count}/${maxChars}`}
        </span>
      )}
    </div>
  )
}
