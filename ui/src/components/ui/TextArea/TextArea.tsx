/**
 * 공용 TextArea — 설계 rooms/design/components.md §1.13 · 요구 R-CHAT-004 · R-CHAT-007 · R-CHAT-013
 * 자동 높이 1 ~ maxRows 줄(기본 3줄: 1줄 36px · 3줄 76px), 넘으면 내부 스크롤. 높이 ≤ 480 화면이면 1줄 고정.
 * onEnter 를 주면 Enter = onEnter, Shift+Enter = 줄바꿈(IME 조합 중 제외). 안 주면 Enter = 줄바꿈이다.
 * maxChars 가 있으면 카운터를 보인다: overflow(기본) = 한도를 넘었을 때만, always = 항상. 넘으면 over 클래스·aria-invalid.
 * jsdom 에는 matchMedia 가 없으므로 부재를 가드한다. 문구는 props 로만 받는다(§1.9).
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import { assignRef } from '@/components/utils/assignRef'
import { cx } from '@/components/utils/cx'
import { isComposingKey } from '@/components/utils/ime'
import { countChars } from '@/state/limits'
import styles from './TextArea.module.css'

export type TextAreaProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  /** 기본 3. 넘으면 내부 스크롤 */
  maxRows?: number
  maxChars?: number
  /** 기본 'overflow' = 한도를 넘었을 때만 카운터 표시. maxChars 가 없으면 무시 */
  counterMode?: 'always' | 'overflow'
  textareaRef?: Ref<HTMLTextAreaElement>
  /** 주면 Enter = onEnter, Shift+Enter = 줄바꿈. 안 주면 Enter = 줄바꿈 */
  onEnter?: () => void
  onEscape?: () => void
  isReadOnly?: boolean
}

const SHORT_SCREEN_QUERY = '(max-height: 480px)'
const FALLBACK_LINE_HEIGHT_PX = 20

const isShortScreen = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(SHORT_SCREEN_QUERY).matches

/** CSS 길이(px)를 숫자로. 읽을 수 없으면 fallback */
const toPx = (raw: string, fallback: number): number => {
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

/** 내용 높이에 맞춘다. 위·아래 padding 을 더한 maxRows 줄이 상한이고, 넘으면 내부 스크롤 */
const fitHeight = (el: HTMLTextAreaElement, maxRows: number): void => {
  const style = window.getComputedStyle(el)
  const rows = isShortScreen() ? 1 : maxRows
  const lineHeight = toPx(style.lineHeight, FALLBACK_LINE_HEIGHT_PX)
  const padding = toPx(style.paddingTop, 0) + toPx(style.paddingBottom, 0)
  const max = lineHeight * rows + padding
  el.style.height = 'auto'
  const natural = el.scrollHeight
  el.style.height = `${Math.min(natural, max)}px`
  el.style.overflowY = natural > max ? 'auto' : 'hidden'
}

/** 내용 높이에 맞추는 ref: 내부 ref(측정용)와 바깥 ref 를 한 콜백 ref 로 잇고, value 가 바뀔 때마다 높이를 다시 맞춘다 */
const useAutoHeightRef = (
  value: string,
  maxRows: number,
  outerRef: Ref<HTMLTextAreaElement> | undefined,
) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const bindRef = useCallback(
    (el: HTMLTextAreaElement | null): void => {
      innerRef.current = el
      assignRef(outerRef, el)
    },
    [outerRef],
  )
  useLayoutEffect(() => {
    if (innerRef.current !== null) fitHeight(innerRef.current, maxRows)
  }, [value, maxRows])
  return bindRef
}

type KeyHandlers = { onEnter: (() => void) | undefined; onEscape: (() => void) | undefined }

/** Esc → onEscape. Enter(Shift·IME 조합 중 제외)는 onEnter 가 있을 때만 가로챈다. 없으면 줄바꿈 기본 동작을 둔다 */
const handleTextAreaKey = (
  event: KeyboardEvent<HTMLTextAreaElement>,
  { onEnter, onEscape }: KeyHandlers,
): void => {
  if (event.key === 'Escape') {
    onEscape?.()
    return
  }
  if (event.key !== 'Enter' || event.shiftKey || onEnter === undefined) return
  if (isComposingKey(event)) return
  event.preventDefault()
  onEnter()
}

export const TextArea = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  maxRows = 3,
  maxChars,
  counterMode = 'overflow',
  textareaRef,
  onEnter,
  onEscape,
  isReadOnly = false,
}: TextAreaProps) => {
  const bindRef = useAutoHeightRef(value, maxRows, textareaRef)
  const count = countChars(value)
  const isOver = maxChars !== undefined && count > maxChars
  const showsCounter = maxChars !== undefined && (counterMode === 'always' || isOver)

  return (
    <div className={styles.wrap}>
      <textarea
        ref={bindRef}
        rows={1}
        className={cx(styles.input, showsCounter && styles.hasCounter)}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isOver ? true : undefined}
        readOnly={isReadOnly}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => handleTextAreaKey(event, { onEnter, onEscape })}
      />
      {showsCounter && (
        <span className={cx(styles.counter, isOver && styles.over)} aria-hidden="true">
          {`${count}/${maxChars}`}
        </span>
      )}
    </div>
  )
}
