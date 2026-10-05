/**
 * IME 조합 판정 — 설계 rooms/design/components.md §1.12(TextInput) · §1.13(TextArea)
 * 한글 조합 중 Enter 는 글자 확정이지 전송·저장이 아니다. isComposing 이 true 이거나 keyCode 가 229 면 조합 중이다.
 */
export const isComposingKey = (event: {
  keyCode: number
  nativeEvent: { isComposing: boolean }
}): boolean => event.nativeEvent.isComposing || event.keyCode === 229
