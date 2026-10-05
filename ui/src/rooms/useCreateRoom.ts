/**
 * useCreateRoom — 설계 rooms/design/functions.md §1.2 · F-RM-14 ~ F-RM-17 (함수 50줄 한계 때문에 RoomsScreen 에서 분리)
 * 요구: R-ROOMS-002 · R-ROOM-002 · R-CHAT-011
 * 새 방 입력 행 상태(create)와 제출을 소유한다. 중복 제출은 상태 기반이다: submitInFlightRef(같은 틱 연타) + isSubmitting.
 * 요청은 @/api 의 createRoom 래퍼만 부른다(Bearer 헤더는 래퍼가 붙인다). 제목은 trim 하지 않고 원문 그대로 보낸다(trim 은 서버 몫).
 * 성공은 목록을 거치지 않고 onCreated(응답 RoomSummary)로 바로 chat 에 들어간다. 실패는 입력값을 유지하고 onFailure 로 알린다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomSummary } from '@shared/types'
import { type ApiError, createRoom } from '@/api'
import { isRoomTitleValid } from '@/state/limits'

export type CreateState = { isOpen: boolean; title: string; isSubmitting: boolean }

const INITIAL_CREATE: CreateState = { isOpen: false, title: '', isSubmitting: false }

export type UseCreateRoomOptions = {
  onCreated: (room: RoomSummary) => void
  onFailure: (error: ApiError) => void
}

export type UseCreateRoomResult = {
  create: CreateState
  openCreate: () => void
  cancelCreate: () => void
  changeTitle: (value: string) => void
  submitCreate: () => Promise<void>
  resetCreate: () => void
}

/** 입력 행 상태와 단순 전이(F-RM-14 ~ F-RM-16 · 처음으로 되돌리기) */
const useCreateState = () => {
  const [create, setCreate] = useState<CreateState>(INITIAL_CREATE)
  /** F-RM-14: 이미 열려 있으면 그대로 */
  const openCreate = useCallback((): void => {
    setCreate(prev => (prev.isOpen ? prev : { ...prev, isOpen: true }))
  }, [])
  /** F-RM-15: 요청 중이면 무시. 닫으면서 입력을 비운다 */
  const cancelCreate = useCallback((): void => {
    setCreate(prev => (prev.isSubmitting ? prev : INITIAL_CREATE))
  }, [])
  /** F-RM-16: 한도를 넘어도 잘라 내지 않는다(만들기만 막는다) */
  const changeTitle = useCallback((value: string): void => {
    setCreate(prev => ({ ...prev, title: value }))
  }, [])
  /** 읽기 전용 전환 등: 요청 중이어도 상태를 처음으로 되돌린다 */
  const resetCreate = useCallback((): void => {
    setCreate(INITIAL_CREATE)
  }, [])
  return { create, setCreate, openCreate, cancelCreate, changeTitle, resetCreate }
}

export const useCreateRoom = ({
  onCreated,
  onFailure,
}: UseCreateRoomOptions): UseCreateRoomResult => {
  const { create, setCreate, ...handlers } = useCreateState()
  const submitInFlightRef = useRef(false)
  const isActiveRef = useRef(false)
  // 부모가 콜백을 매번 새로 만들어도 진행 중인 요청이 최신 콜백을 부르도록 ref 로 읽는다
  const latestRef = useRef({ onCreated, onFailure })

  useLayoutEffect(() => {
    latestRef.current = { onCreated, onFailure }
  })
  // 언마운트 뒤에 도착한 응답을 버리기 위한 활성 플래그
  useEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])

  /** F-RM-17 */
  const submitCreate = useCallback(async (): Promise<void> => {
    const { title } = create
    if (submitInFlightRef.current || !isRoomTitleValid(title)) return
    submitInFlightRef.current = true
    setCreate(prev => ({ ...prev, isSubmitting: true }))
    const result = await createRoom({ title })
    submitInFlightRef.current = false
    if (!isActiveRef.current) return
    if (result.ok) {
      latestRef.current.onCreated(result.value)
      return
    }
    setCreate(prev => ({ ...prev, isSubmitting: false }))
    latestRef.current.onFailure(result.error)
  }, [create, setCreate])

  return { create, submitCreate, ...handlers }
}
