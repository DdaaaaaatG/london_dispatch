/**
 * 공용 훅 useLongPress — 설계 rooms/design/components.md §1.19 · 요구 R-CHAT-007
 * 터치·마우스 공통 롱프레스(500ms) + 우클릭(contextmenu)을 한 핸들러 묶음으로 통합한다.
 * 누른 자리에서 10px 넘게 움직이면(스크롤 중) 취소한다. 훅은 메시지를 모른다 → 화면 비종속.
 * 핸들러 묶음은 리렌더해도 같은 참조이고, 최신 onLongPress 는 ref 로 읽는다. 타이머는 언마운트 때 해제한다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { MouseEvent, PointerEvent, RefObject } from 'react'

export const LONG_PRESS_MS = 500
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10

export type UseLongPressOptions = { onLongPress: () => void; delayMs?: number }

export type LongPressHandlers = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerLeave: () => void
  onPointerCancel: () => void
  onContextMenu: (e: MouseEvent<HTMLElement>) => void
}

type Point = { x: number; y: number }

const movedTooFar = (start: Point, e: PointerEvent<HTMLElement>): boolean =>
  Math.abs(e.clientX - start.x) > LONG_PRESS_MOVE_TOLERANCE_PX ||
  Math.abs(e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX

/** 한 번에 하나만 도는 타이머. 새로 시작하면 이전 것을 해제하고, 언마운트 때도 해제한다 */
const usePressTimer = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useCallback((): void => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  const start = useCallback(
    (onFire: () => void, delayMs: number): void => {
      cancel()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        onFire()
      }, delayMs)
    },
    [cancel],
  )
  const isRunning = useCallback((): boolean => timerRef.current !== null, [])
  useEffect(() => cancel, [cancel])
  return { start, cancel, isRunning }
}

/** 누름 제스처: 좌클릭·터치 시작 좌표 기록 + 타이머, 10px 넘게 움직이면 취소. 발화 여부는 consumeFired 로 한 번 읽는다 */
const usePressGesture = (latestRef: RefObject<() => void>, delayMs: number) => {
  const startRef = useRef<Point | null>(null)
  const firedRef = useRef(false)
  const { start, cancel, isRunning } = usePressTimer()

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>): void => {
      if (e.button !== 0) return
      startRef.current = { x: e.clientX, y: e.clientY }
      firedRef.current = false
      start(() => {
        firedRef.current = true
        latestRef.current()
      }, delayMs)
    },
    [start, delayMs, latestRef],
  )
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>): void => {
      const origin = startRef.current
      if (origin !== null && isRunning() && movedTooFar(origin, e)) cancel()
    },
    [cancel, isRunning],
  )
  /** 롱프레스가 방금 발화했으면 true 를 돌려주고 표시를 지운다 */
  const consumeFired = useCallback((): boolean => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])
  return { onPointerDown, onPointerMove, cancel, consumeFired }
}

export const useLongPress = ({
  onLongPress,
  delayMs = LONG_PRESS_MS,
}: UseLongPressOptions): LongPressHandlers => {
  const latestRef = useRef(onLongPress)
  const { onPointerDown, onPointerMove, cancel, consumeFired } = usePressGesture(latestRef, delayMs)

  useLayoutEffect(() => {
    latestRef.current = onLongPress
  })

  /** 롱프레스 직후의 브라우저 contextmenu 는 한 번 삼킨다(시트가 둘 뜨지 않게). 그 밖의 contextmenu 는 롱프레스와 같다 */
  const onContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>): void => {
      e.preventDefault()
      if (!consumeFired()) latestRef.current()
    },
    [consumeFired],
  )

  return useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu,
    }),
    [onPointerDown, onPointerMove, cancel, onContextMenu],
  )
}
