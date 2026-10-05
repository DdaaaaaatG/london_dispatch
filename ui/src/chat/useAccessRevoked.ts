/**
 * useAccessRevoked — 설계 chat/design/functions.md F-CH-29 · 요구 R-CHAT-011 · R-CHAT-008
 * viewer.canWrite 가 true → false 로 바뀐 순간(App 이 한 방향으로 전환)에만 onRevoked 를 부른다. 처음부터 읽기 전용이면 부르지 않는다.
 * 렌더는 canWrite 로 이미 막혀 있어 effect 전 커밋에도 쓰기 UI 가 그려지지 않는다. 이 effect 는 숨은 상태(시트·쓰기 팻말·편집)를 정리하는 일만 한다.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'

export const useAccessRevoked = (canWrite: boolean, onRevoked: () => void): void => {
  const wasWritableRef = useRef(canWrite)
  const latestRef = useRef(onRevoked)

  useLayoutEffect(() => {
    latestRef.current = onRevoked
  })

  useEffect(() => {
    if (wasWritableRef.current && !canWrite) latestRef.current()
    wasWritableRef.current = canWrite
  }, [canWrite])
}
