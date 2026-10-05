/**
 * App — 화면 분기. 설계 rooms/design/functions.md §1.1 · F-RM-01 ~ F-RM-04 · 주 문서 §11.2 D-1 · D-2
 * 요구: R-ROOMS-001 · R-ROOMS-004 · R-NFR-004
 * 외부 라우터 없이 view 상태로 rooms / chat 을 가른다. 방 정보는 rooms 목록에서 고른 객체를 그대로 chat 에 넘긴다.
 * S1 은 토큰을 읽지 않으므로 viewer 는 항상 READ_ONLY_VIEWER 다(토큰 파싱은 S2 의 state/token.ts).
 * 마지막 본 방 기록은 ChatScreen 이 한다(마운트 시 저장, ‹ 뒤로 시 삭제). App 은 저장소를 읽기만 한다.
 */
import { useCallback, useState } from 'react'
import type { RoomSummary } from '@shared/types'
import { ChatScreen } from '@/chat'
import { loadLastRoomId } from '@/components/utils/storage'
import { RoomsScreen } from '@/rooms'
import { READ_ONLY_VIEWER } from '@/state/viewer'

export type View = { screen: 'rooms' } | { screen: 'chat'; room: RoomSummary }

export const App = () => {
  const [view, setView] = useState<View>({ screen: 'rooms' })
  // 시작 시 한 번만 읽는 마지막 본 방 id(최초 렌더 1회)
  const [autoOpenRoomId, setAutoOpenRoomId] = useState<string | null>(() => loadLastRoomId())

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

  if (view.screen === 'chat') {
    return (
      <ChatScreen
        key={view.room.id}
        room={view.room}
        viewer={READ_ONLY_VIEWER}
        onBack={backToRooms}
      />
    )
  }
  return (
    <RoomsScreen
      viewer={READ_ONLY_VIEWER}
      autoOpenRoomId={autoOpenRoomId}
      onOpenRoom={openRoom}
      onAutoOpenSettled={settleAutoOpen}
    />
  )
}
