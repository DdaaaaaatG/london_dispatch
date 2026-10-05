/**
 * 바깥에서 받은 ref(객체 또는 콜백)에 요소를 넣는다 — 공용 부품이 내부 ref 와 외부 ref 를 함께 쓸 때 사용
 * 예: TextArea 는 자동 높이 계산용 내부 ref 와 호출 쪽 textareaRef 를 한 콜백 ref 로 묶는다.
 */
import type { Ref } from 'react'

export const assignRef = <T>(ref: Ref<T> | undefined, value: T | null): void => {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}
