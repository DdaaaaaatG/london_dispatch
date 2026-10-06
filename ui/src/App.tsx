/**
 * App — 화면 분기 · 보는 사람(viewer) · 갠홈 주인 여부(isOwner). 설계 rooms/design/functions.md §1.1 · F-RM-01 ~ F-RM-04 · F-RM-12 · F-RM-13 · F-RM-24 ~ F-RM-27 · 주 문서 §11.2 D-1 · D-2 · D-4
 * 요구: R-ROOMS-001 · R-ROOMS-004 · R-CHAT-008 · R-CHAT-009 · R-CHAT-011 · R-NFR-004 · R-SET-009 · R-SET-010
 * 외부 라우터 없이 view 상태로 rooms / chat / settings 를 가른다. 방 정보는 rooms 목록에서 고른 객체(또는 생성 응답)를 그대로 chat 에 넘긴다.
 * viewer 는 App 상태 하나다: 첫 렌더 1회 토큰 유무로 정하고, 화면의 쓰기 UI 가 인증 실패를 알리면 읽기 전용으로 한 방향 전환한다.
 * isOwner(S3c)는 토큰이 있을 때 첫 렌더 뒤 1회 설정 읽기로 정한다(200 만 주인). 실패는 조용히 비주인이며 viewer 를 건드리지 않는다.
 * 마지막 본 방 기록은 ChatScreen 이 한다(마운트 시 저장, ‹ 뒤로 시 삭제). App 은 저장소를 읽기만 한다. 토큰은 getToken 으로 있고 없음만 본다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RoomSummary } from '@shared/types'
import { getCharacterSettings } from '@/api'
import { ChatScreen } from '@/chat'
import type { ToastProps } from '@/components/ui/Toast'
import { loadLastRoomId } from '@/components/utils/storage'
import { RoomsScreen } from '@/rooms'
import { SettingsScreen } from '@/settings'
import { clearToken, getToken } from '@/state/token'
import { READ_ONLY_VIEWER, type Viewer, viewerFromToken } from '@/state/viewer'

export type View =
  { screen: 'rooms' } | { screen: 'chat'; room: RoomSummary } | { screen: 'settings' }

/** 설정 화면 진입·이탈(F-RM-25 · F-RM-26)과 rooms 로 돌아올 때 띄울 안내(roomsNotice) */
const useSettingsNav = (setView: Dispatch<SetStateAction<View>>, settleAutoOpen: () => void) => {
  const [roomsNotice, setRoomsNotice] = useState<ToastProps | null>(null)
  /** F-RM-25: ⚙ → 설정 화면. 돌아올 때 마지막 본 방으로 자동 진입하지 않게 자동 진입 id 를 비운다 */
  const openSettings = useCallback((): void => {
    setView({ screen: 'settings' })
    settleAutoOpen()
  }, [setView, settleAutoOpen])
  /** F-RM-26: 설정 화면 → rooms. 안내가 있으면 RoomsScreen 이 마운트 때 1회 띄운다. 마지막 본 방 기록은 건드리지 않는다 */
  const leaveSettings = useCallback(
    (notice?: ToastProps): void => {
      setRoomsNotice(notice ?? null)
      setView({ screen: 'rooms' })
    },
    [setView],
  )
  const clearRoomsNotice = useCallback((): void => {
    setRoomsNotice(null)
  }, [])
  return { roomsNotice, openSettings, leaveSettings, clearRoomsNotice }
}

/** 화면 분기(view) · 자동 진입 id */
const useViewState = () => {
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
  /** F-RM-13: 이름 변경 응답을 보는 중인 방에 반영한다. 같은 key 라 ChatScreen 은 다시 마운트되지 않는다 */
  const replaceRoomInView = useCallback((room: RoomSummary): void => {
    setView(current =>
      current.screen === 'chat' && current.room.id === room.id ? { screen: 'chat', room } : current,
    )
  }, [])
  const settingsNav = useSettingsNav(setView, settleAutoOpen)
  return {
    view,
    autoOpenRoomId,
    openRoom,
    backToRooms,
    settleAutoOpen,
    replaceRoomInView,
    ...settingsNav,
  }
}

/** 쓰기 가능 여부(viewer). 최초 렌더 1회 토큰 유무로 정하고, 읽기 전용으로만 바뀐다 */
const useViewer = () => {
  const [viewer, setViewer] = useState<Viewer>(() => viewerFromToken(getToken()))
  /** F-RM-12: 쓰기 결과가 인증 실패다. 토큰을 비우고 읽기 전용으로 바꾼다(되돌리기는 새로 고침뿐) */
  const revokeWrite = useCallback((): void => {
    clearToken()
    setViewer(READ_ONLY_VIEWER)
  }, [])
  return { viewer, revokeWrite }
}

/**
 * 갠홈 주인 여부(⚙ 렌더 조건). F-RM-24: 토큰이 있으면 첫 렌더 뒤 1회 설정 읽기로 묻는다 — 응답 본문은 버린다(설정 화면이 들어올 때 다시 읽는다).
 * 200 만 주인이다. 401 · 403(LEVEL_TOO_LOW · OWNER_ONLY) · NETWORK · 5xx 는 아무것도 하지 않는다: revokeWrite·토스트 없음(R-SET-010).
 * StrictMode 의 effect 재실행은 ref 가드가 막는다. 취소 플래그는 두지 않는다(App 은 앱 수명 내내 마운트돼 있다).
 */
const useOwner = () => {
  const [isOwner, setIsOwner] = useState(false)
  const probeStartedRef = useRef(false)
  const markOwner = useCallback((): void => setIsOwner(true), [])
  /** F-RM-27: 설정 화면이 열기·저장에서 OWNER_ONLY 를 받았다. viewer 는 그대로(읽기 전용 전환 아님) */
  const loseOwner = useCallback((): void => setIsOwner(false), [])

  useEffect(() => {
    if (probeStartedRef.current) return
    probeStartedRef.current = true
    if (getToken() === null) return
    void getCharacterSettings().then(result => {
      if (result.ok) markOwner()
    })
  }, [markOwner])
  return { isOwner, loseOwner }
}

export const App = () => {
  const state = useViewState()
  const { viewer, revokeWrite } = useViewer()
  const { isOwner, loseOwner } = useOwner()
  const { view } = state

  if (view.screen === 'settings') {
    return (
      <SettingsScreen
        onLeave={state.leaveSettings}
        onAuthFailure={revokeWrite}
        onOwnerLost={loseOwner}
      />
    )
  }
  if (view.screen === 'chat') {
    return (
      <ChatScreen
        key={view.room.id}
        room={view.room}
        viewer={viewer}
        onBack={state.backToRooms}
        onAuthFailure={revokeWrite}
        onRoomRenamed={state.replaceRoomInView}
      />
    )
  }
  return (
    <RoomsScreen
      viewer={viewer}
      autoOpenRoomId={state.autoOpenRoomId}
      onOpenRoom={state.openRoom}
      onAutoOpenSettled={state.settleAutoOpen}
      onAuthFailure={revokeWrite}
      isOwner={isOwner}
      onOpenSettings={state.openSettings}
      entryNotice={state.roomsNotice}
      onEntryNoticeShown={state.clearRoomsNotice}
    />
  )
}
