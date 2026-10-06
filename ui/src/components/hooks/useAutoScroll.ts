/**
 * 공용 훅 useAutoScroll — 설계 chat/design/components.md §3 · F-CH-14
 * 요구: R-CHAT-003(이전 페이지 앵커 · 새 메시지 자동 스크롤) · R-CHAT-010(스크롤 위치 복원)
 * 훅은 메시지 타입을 모른다(id 두 개와 스크롤 박스만 안다). IntersectionObserver 를 쓰지 않고 애니메이션 없이 즉시 이동한다.
 * 계산은 ui/src/state/scroll.ts 의 순수 함수가 한다.
 * S3: tailKey 가 null 이 아닌 새 값으로 바뀌면(임시 말풍선 등장 · 실패 전환) 바뀌기 전 측정이 맨 아래 근처였을 때 맨 아래로 따라간다.
 * S2: 마지막 메시지 삭제로 목록이 비면(firstId null) 첫 배치 상태로 되돌리고, 다시 채워질 때는 저장 거리를 무시하고 맨 아래에 놓는다(TC-CH-046).
 * 빈 화면 커밋 없이 한 번에 새 최신 페이지로 바뀐 경우(새 목록이 이전 목록보다 전부 앞)도 목록 교체로 보고 맨 아래에 놓는다.
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
  /** S3: 목록 끝에 붙는 메시지 아닌 조각(임시·실패 말풍선)의 식별 값. 새 값이 되면 맨 아래 근처였을 때 따라간다. 기본 null */
  tailKey?: string | null
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
  /** 목록이 비었다가 다시 채워지는 중이면 저장 거리를 무시하고 맨 아래로 배치한다 */
  repositionToBottom: boolean
  lastDistance: number | null
}

const createMemo = (): Memo => ({
  metrics: null,
  ids: { firstId: null, lastId: null },
  positioned: false,
  repositionToBottom: false,
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

/**
 * 새 목록이 이전 목록보다 전부 앞이다 = 목록 교체(앞붙임·뒤붙임·삭제로는 생길 수 없다).
 * 예: 마지막 메시지 삭제 뒤 최신 페이지를 다시 받았는데 빈 화면 커밋 없이 한 번에 합쳐진 경우. 이때는 맨 아래에 놓는다.
 */
const isReplaced = (prev: Ids, next: Ids): boolean =>
  prev.firstId !== null && next.lastId !== null && next.lastId < prev.firstId

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
    el.scrollTop = restoreScrollTop(el, memo.repositionToBottom ? null : initialDistance)
    memo.repositionToBottom = false
  } else if (isReplaced(memo.ids, next)) {
    el.scrollTop = restoreScrollTop(el, null)
  } else if (memo.metrics !== null) {
    adjustAfterChange(el, memo.metrics, memo.ids, next)
  }
  remember(memo, el)
  memo.ids = next
  return isFirstPlacement
}

/**
 * 마지막 메시지 삭제로 목록이 비었다(재로드 대기). 다음에 채워질 때는 저장 거리가 아니라 맨 아래에 배치하도록 되돌린다.
 * 요소(containerRef)는 목록이 비면 이미 사라졌을 수 있으므로 요소 검사보다 먼저 처리한다
 */
const resetForReload = (memo: Memo): void => {
  memo.positioned = false
  memo.repositionToBottom = true
  memo.ids = { firstId: null, lastId: null }
  memo.lastDistance = null
}

/**
 * 목록이 바뀐 커밋에서 하는 일. 비었으면 첫 배치 상태로 되돌리고, 요소가 있으면 배치·보정한다.
 * 첫 배치가 맨 위 근처이고 이전 페이지를 자동 요청해도 되면 onReachTop 을 한 번 부른다.
 */
const applyListChange = (
  memo: Memo,
  el: HTMLElement | null,
  ids: Ids,
  initialDistance: number | null,
  latest: Latest,
): void => {
  if (ids.firstId === null) {
    if (memo.positioned) resetForReload(memo)
    return
  }
  if (el === null) return
  const isFirst = place(el, memo, ids, initialDistance)
  const metrics = memo.metrics
  if (isFirst && metrics !== null && isNearTop(metrics) && latest.canAutoLoadOlder) {
    latest.onReachTop()
  }
}

/** 스크롤 박스를 읽고 움직이는 동작 4개(onScroll · isNearBottom · scrollToBottom · getDistanceFromBottom) */
const useScrollActions = (
  containerRef: RefObject<HTMLDivElement | null>,
  memoRef: RefObject<Memo>,
  latestRef: RefObject<Latest>,
): Omit<UseAutoScrollResult, 'containerRef'> => {
  const onScroll = useCallback((): void => {
    const el = containerRef.current
    if (el === null) return
    const metrics = remember(memoRef.current, el)
    const latest = latestRef.current
    if (latest.canAutoLoadOlder && isNearTop(metrics)) latest.onReachTop()
    if (isNearBottom(metrics)) latest.onReachBottom()
  }, [containerRef, memoRef, latestRef])

  const isNearBottomNow = useCallback((): boolean => {
    const el = containerRef.current
    const metrics = el === null ? memoRef.current.metrics : measure(el)
    return metrics === null || isNearBottom(metrics)
  }, [containerRef, memoRef])

  const scrollToBottom = useCallback((): void => {
    const el = containerRef.current
    if (el === null) return
    el.scrollTop = el.scrollHeight
    remember(memoRef.current, el)
  }, [containerRef, memoRef])

  const getDistanceFromBottom = useCallback(
    (): number | null => memoRef.current.lastDistance,
    [memoRef],
  )

  return { onScroll, isNearBottom: isNearBottomNow, scrollToBottom, getDistanceFromBottom }
}

/** 임시·실패 말풍선(tailKey)이 새로 나타나거나 바뀌면, 바뀌기 전에 맨 아래 근처였을 때만 맨 아래로 간다(배지는 늘리지 않는다) */
const useTailFollow = (
  memoRef: RefObject<Memo>,
  containerRef: RefObject<HTMLDivElement | null>,
  tailKey: string | null,
): void => {
  useLayoutEffect(() => {
    const el = containerRef.current
    const memo = memoRef.current
    if (tailKey === null || el === null || !memo.positioned) return
    if (memo.metrics === null || isNearBottom(memo.metrics)) el.scrollTop = el.scrollHeight
    remember(memo, el)
  }, [tailKey, memoRef, containerRef])
}

export const useAutoScroll = (options: UseAutoScrollOptions): UseAutoScrollResult => {
  const { firstId, lastId, initialDistanceFromBottom, canAutoLoadOlder } = options
  const { onReachTop, onReachBottom, tailKey = null } = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const memoRef = useRef<Memo>(createMemo())
  const latestRef = useRef<Latest>({ canAutoLoadOlder, onReachTop, onReachBottom })

  // 최신 값을 담아 오래된 클로저를 막는다. 아래 배치 effect 보다 먼저 선언해 같은 커밋에서 최신 값을 읽게 한다
  useLayoutEffect(() => {
    latestRef.current = { canAutoLoadOlder, onReachTop, onReachBottom }
  }, [canAutoLoadOlder, onReachTop, onReachBottom])

  // 첫 배치(저장 거리 복원) · 앞붙임(읽던 자리 유지) · 뒤붙임(맨 아래 근처일 때만 따라간다)
  useLayoutEffect(() => {
    const ids = { firstId, lastId }
    applyListChange(
      memoRef.current,
      containerRef.current,
      ids,
      initialDistanceFromBottom,
      latestRef.current,
    )
  }, [firstId, lastId, initialDistanceFromBottom])

  useTailFollow(memoRef, containerRef, tailKey)

  const actions = useScrollActions(containerRef, memoRef, latestRef)
  return { containerRef, ...actions }
}
