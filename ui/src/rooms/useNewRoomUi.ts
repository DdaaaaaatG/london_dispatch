/**
 * useNewRoomUi — 설계 rooms/design/functions.md F-RM-14 · F-RM-15 · F-RM-18 · F-RM-19 (RoomsScreen 50줄 한계 분리)
 * 요구: R-ROOMS-002 · R-CHAT-008 · R-CHAT-011
 * 새 방 쓰기 UI 의 화면 쪽 조립: 토스트 · 실패 처리(인증 실패 전파) · 포커스 이동 · 읽기 전용 전환 정리.
 * 화면은 토큰을 읽지도 저장하지도 않는다. viewer.canWrite 가 true → false 로 바뀌면(App 이 한 방향 전환) 입력 행 상태를 비우고
 * 사라진 입력에 있던 포커스를 h1 로 옮긴다.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { RoomSummary } from '@shared/types'
import { type ApiError, isAuthFailure } from '@/api'
import { useToast } from '@/components/hooks/useToast'
import type { ToastState } from '@/components/hooks/useToast'
import type { Viewer } from '@/state/viewer'
import { toastToneOf } from '@/state/writeFailure'
import { writeErrorText } from './labels'
import { type CreateState, useCreateRoom } from './useCreateRoom'

export type UseNewRoomUiOptions = {
  viewer: Viewer
  /** 전환 뒤 포커스를 받을 h1 */
  titleRef: RefObject<HTMLHeadingElement | null>
  onOpenRoom: (room: RoomSummary) => void
  onAuthFailure: () => void
}

export type NewRoomUi = {
  create: CreateState
  toast: ToastState
  newRoomButtonRef: RefObject<HTMLButtonElement | null>
  titleInputRef: RefObject<HTMLInputElement | null>
  openCreate: () => void
  cancelCreate: () => void
  changeTitle: (value: string) => void
  submitCreate: () => void
}

type NewRoomFocusOptions = Pick<UseNewRoomUiOptions, 'viewer' | 'titleRef'> & {
  isOpen: boolean
  resetCreate: () => void
}

/** 포커스 이동: 입력 행이 열리면 입력으로, 쓰기 → 읽기 전용 전환이면 행을 비우고 h1 로(F-RM-14 · F-RM-19) */
const useNewRoomFocus = ({ viewer, titleRef, isOpen, resetCreate }: NewRoomFocusOptions) => {
  const newRoomButtonRef = useRef<HTMLButtonElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const wasWritableRef = useRef(viewer.canWrite)

  // 입력 행이 열린 커밋 뒤 입력에 포커스한다
  useLayoutEffect(() => {
    if (isOpen) titleInputRef.current?.focus()
  }, [isOpen])

  // F-RM-19: 쓰기 → 읽기 전용 전환이면 입력 행을 비우고 포커스를 h1 로
  useEffect(() => {
    if (wasWritableRef.current && !viewer.canWrite) {
      resetCreate()
      titleRef.current?.focus()
    }
    wasWritableRef.current = viewer.canWrite
  }, [viewer.canWrite, resetCreate, titleRef])

  return { newRoomButtonRef, titleInputRef }
}

export const useNewRoomUi = ({
  viewer,
  titleRef,
  onOpenRoom,
  onAuthFailure,
}: UseNewRoomUiOptions): NewRoomUi => {
  const { toast, showToast } = useToast()

  /** F-RM-18: 인증 실패면 먼저 App 에 알리고(읽기 전용 전환), 이어 코드별 안내를 토스트로 띄운다 */
  const handleFailure = (error: ApiError): void => {
    if (isAuthFailure(error)) onAuthFailure()
    showToast(writeErrorText(error), toastToneOf(error))
  }
  const state = useCreateRoom({ onCreated: onOpenRoom, onFailure: handleFailure })
  const { create, resetCreate } = state
  const { newRoomButtonRef, titleInputRef } = useNewRoomFocus({
    viewer,
    titleRef,
    isOpen: create.isOpen,
    resetCreate,
  })

  /** F-RM-14: 이미 열려 있어도 입력으로 포커스를 가져온다(닫힌 상태면 위 effect 가 커밋 뒤 처리) */
  const openCreate = (): void => {
    state.openCreate()
    titleInputRef.current?.focus()
  }
  /** F-RM-15: 요청 중이면 무시. 닫은 뒤 「+ 새 방」 으로 포커스를 돌린다 */
  const cancelCreate = (): void => {
    if (create.isSubmitting) return
    state.cancelCreate()
    newRoomButtonRef.current?.focus()
  }
  const submitCreate = (): void => {
    void state.submitCreate()
  }

  return {
    create,
    toast,
    newRoomButtonRef,
    titleInputRef,
    openCreate,
    cancelCreate,
    changeTitle: state.changeTitle,
    submitCreate,
  }
}
