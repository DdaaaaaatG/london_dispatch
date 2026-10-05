/**
 * App — 화면 분기 · 보는 사람(viewer). 설계 rooms/design/functions.md §1.1 · F-RM-01 ~ F-RM-04 · F-RM-12 · F-RM-13 · 주 문서 §11.2 D-1 · D-2 · D-4
 * 요구: R-ROOMS-001 · R-ROOMS-004 · R-CHAT-008 · R-CHAT-009 · R-CHAT-011 · R-NFR-004
 * 외부 라우터 없이 view 상태로 rooms / chat 을 가른다. 방 정보는 rooms 목록에서 고른 객체(또는 생성 응답)를 그대로 chat 에 넘긴다.
 * viewer 는 App 상태 하나다: 첫 렌더 1회 토큰 유무로 정하고, 두 화면의 쓰기 UI 가 인증 실패를 알리면 읽기 전용으로 한 방향 전환한다.
 * 마지막 본 방 기록은 ChatScreen 이 한다(마운트 시 저장, ‹ 뒤로 시 삭제). App 은 저장소를 읽기만 한다.
 */
import { useCallback, useState } from 'react'
import type { RoomSummary } from '@shared/types'
import { ChatScreen } from '@/chat'
import { loadLastRoomId } from '@/components/utils/storage'
import { RoomsScreen } from '@/rooms'
import { clearToken, getToken } from '@/state/token'
import { READ_ONLY_VIEWER, type Viewer, viewerFromToken } from '@/state/viewer'

export type View = { screen: 'rooms' } | { screen: 'chat'; room: RoomSummary }

/** 화면 분기(view) · 자동 진입 id · 보는 사람(viewer)과 그 전환 함수 */
const useAppState = () => {
  const [view, setView] = useState<View>({ screen: 'rooms' })
  // 시작 시 한 번만 읽는 마지막 본 방 id(최초 렌더 1회)
  const [autoOpenRoomId, setAutoOpenRoomId] = useState<string | null>(() => loadLastRoomId())
  // 쓰기 가능 여부(최초 렌더 1회 토큰 유무로 정한다). 읽기 전용으로만 바뀐다
  const [viewer, setViewer] = useState<Viewer>(() => viewerFromToken(getToken()))

  /** F-RM-02: 화면 전환만 한다. 기록 저장은 ChatScreen 마운트가 한다 */
  const openRoom = useCallback((room: RoomSummary): void => {
    setView({ screen: 'chat', room })
    setAutoOpenRoomId(null)
  }, [])
  /** F-RM-03: RoomsScreen 이 새로 마운트되어 목록을 다시 불러온다 */
  const backToRooms = useCallback((): void => {
    setView({ screen: 'rooms' })
  }, [])
  /** F-RM-04: 자동 진입 판정이 끝났다 */
  const settleAutoOpen = useCallback((): void => {
    setAutoOpenRoomId(null)
  }, [])
  /** F-RM-12: 쓰기 결과가 인증 실패다. 토큰을 비우고 읽기 전용으로 바꾼다(되돌리기는 새로 고침뿐) */
  const revokeWrite = useCallback((): void => {
    clearToken()
    setViewer(READ_ONLY_VIEWER)
  }, [])
  /** F-RM-13: 이름 변경 응답을 보는 중인 방에 반영한다. 같은 key 라 ChatScreen 은 다시 마운트되지 않는다 */
  const replaceRoomInView = useCallback((room: RoomSummary): void => {
    setView(current =>
      current.screen === 'chat' && current.room.id === room.id ? { screen: 'chat', room } : current,
    )
  }, [])
  return {
    view,
    autoOpenRoomId,
    viewer,
    openRoom,
    backToRooms,
    settleAutoOpen,
    revokeWrite,
    replaceRoomInView,
  }
}

export const App = () => {
  const {
    view,
    autoOpenRoomId,
    viewer,
    openRoom,
    backToRooms,
    settleAutoOpen,
    revokeWrite,
    replaceRoomInView,
  } = useAppState()

  if (view.screen === 'chat') {
    return (
      <ChatScreen
        key={view.room.id}
        room={view.room}
        viewer={viewer}
        onBack={backToRooms}
        onAuthFailure={revokeWrite}
        onRoomRenamed={replaceRoomInView}
      />
    )
  }
  return (
    <RoomsScreen
      viewer={viewer}
      autoOpenRoomId={autoOpenRoomId}
      onOpenRoom={openRoom}
      onAutoOpenSettled={settleAutoOpen}
      onAuthFailure={revokeWrite}
    />
  )
}
