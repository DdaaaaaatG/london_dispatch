/**
 * 공용 훅 useAutoScroll — 설계 chat/design/components.md §3 · F-CH-14
 * 요구: R-CHAT-003(이전 페이지 앵커 · 새 메시지 자동 스크롤) · R-CHAT-010(스크롤 위치 복원)
 * 훅은 메시지 타입을 모른다(id 두 개와 스크롤 박스만 안다). IntersectionObserver 를 쓰지 않고 애니메이션 없이 즉시 이동한다.
 * 계산은 ui/src/state/scroll.ts 의 순수 함수가 한다.
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import {
  type ScrollMetrics,
  anchorScrollTop,
  distanceFromBottom,
  isNearBottom,
  isNearTop,
  restoreScrollTop,
} from '@/state/scroll'

export type UseAutoScrollOptions = {
  /** 현재 목록 첫 메시지 id (없으면 null) */
  firstId: number | null
  /** 현재 목록 끝 메시지 id */
  lastId: number | null
  /** 복원할 거리(px). null = 맨 아래 */
  initialDistanceFromBottom: number | null
  /** 위 끝 도달 시 onReachTop 을 불러도 되는가 */
  canAutoLoadOlder: boolean
  onReachTop: () => void
  /** 맨 아래 근처 도달(배지 해제) */
  onReachBottom: () => void
}

export type UseAutoScrollResult = {
  containerRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  /** 메시지 추가 시점에 쓴다(S2·S3). 스크롤 박스가 아직 없으면 true */
  isNearBottom: () => boolean
  scrollToBottom: () => void
  /** 첫 배치 전이면 null. 언마운트 뒤에도 마지막 값 */
  getDistanceFromBottom: () => number | null
}

type Ids = { firstId: number | null; lastId: number | null }
type Latest = Pick<UseAutoScrollOptions, 'canAutoLoadOlder' | 'onReachTop' | 'onReachBottom'>

/** 훅이 렌더 사이에 기억하는 값(ref 안에서만 바꾼다) */
type Memo = {
  /** 마지막 측정. 앞·뒤붙임 직전 상태(붙기 전 측정)로 쓰인다 */
  metrics: ScrollMetrics | null
  ids: Ids
  /** 첫 배치를 마쳤는가 */
  positioned: boolean
  lastDistance: number | null
}

const createMemo = (): Memo => ({
  metrics: null,
  ids: { firstId: null, lastId: null },
  positioned: false,
  lastDistance: null,
})

const measure = (el: HTMLElement): ScrollMetrics => ({
  scrollTop: el.scrollTop,
  scrollHeight: el.scrollHeight,
  clientHeight: el.clientHeight,
})

/** 지금 상태를 측정해 기억한다 */
const remember = (memo: Memo, el: HTMLElement): ScrollMetrics => {
  const metrics = measure(el)
  memo.metrics = metrics
  memo.lastDistance = distanceFromBottom(metrics)
  return metrics
}

/** 앞붙임 보정 → 뒤붙임 판정 순서로 둘 다 적용한다. before 는 붙기 전 측정값 */
const adjustAfterChange = (el: HTMLElement, before: ScrollMetrics, prev: Ids, next: Ids): void => {
  if (prev.firstId !== null && next.firstId !== null && next.firstId < prev.firstId) {
    el.scrollTop = anchorScrollTop(before, el.scrollHeight)
  }
  if (prev.lastId !== null && next.lastId !== null && next.lastId > prev.lastId) {
    if (isNearBottom(before)) el.scrollTop = el.scrollHeight
  }
}

/** 첫 배치(저장 거리 복원) 또는 앞·뒤붙임 보정을 하고 기억을 갱신한다. 첫 배치였으면 true */
const place = (el: HTMLElement, memo: Memo, next: Ids, initialDistance: number | null): boolean => {
  const isFirstPlacement = !memo.positioned
  if (isFirstPlacement) {
    memo.positioned = true
    el.scrollTop = restoreScrollTop(el, initialDistance)
  } else if (memo.metrics !== null) {
    adjustAfterChange(el, memo.metrics, memo.ids, next)
  }
  remember(memo, el)
  memo.ids = next
  return isFirstPlacement
}

export const useAutoScroll = (options: UseAutoScrollOptions): UseAutoScrollResult => {
  const { firstId, lastId, initialDistanceFromBottom, canAutoLoadOlder } = options
  const { onReachTop, onReachBottom } = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const memoRef = useRef<Memo>(createMemo())
  const latestRef = useRef<Latest>({ canAutoLoadOlder, onReachTop, onReachBottom })

  // 최신 값을 담아 오래된 클로저를 막는다. 아래 배치 effect 보다 먼저 선언해 같은 커밋에서 최신 값을 읽게 한다
  useLayoutEffect(() => {
    latestRef.current = { canAutoLoadOlder, onReachTop, onReachBottom }
  }, [canAutoLoadOlder, onReachTop, onReachBottom])

  // 첫 배치(저장 거리 복원) · 앞붙임(읽던 자리 유지) · 뒤붙임(맨 아래 근처일 때만 따라간다)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (el === null || firstId === null) return
    const memo = memoRef.current
    const isFirst = place(el, memo, { firstId, lastId }, initialDistanceFromBottom)
    const metrics = memo.metrics
    if (isFirst && metrics !== null && isNearTop(metrics) && latestRef.current.canAutoLoadOlder) {
      latestRef.current.onReachTop()
    }
  }, [firstId, lastId, initialDistanceFromBottom])

  const onScroll = useCallback((): void => {
    const el = containerRef.current
    if (el === null) return
    const metrics = remember(memoRef.current, el)
    const latest = latestRef.current
    if (latest.canAutoLoadOlder && isNearTop(metrics)) latest.onReachTop()
    if (isNearBottom(metrics)) latest.onReachBottom()
  }, [])

  const isNearBottomNow = useCallback((): boolean => {
    const el = containerRef.current
    const metrics = el === null ? memoRef.current.metrics : measure(el)
    return metrics === null || isNearBottom(metrics)
  }, [])

  const scrollToBottom = useCallback((): void => {
    const el = containerRef.current
    if (el === null) return
    el.scrollTop = el.scrollHeight
    remember(memoRef.current, el)
  }, [])

  const getDistanceFromBottom = useCallback((): number | null => memoRef.current.lastDistance, [])

  return {
    containerRef,
    onScroll,
    isNearBottom: isNearBottomNow,
    scrollToBottom,
    getDistanceFromBottom,
  }
}
