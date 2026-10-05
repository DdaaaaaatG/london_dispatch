/**
 * rooms(방 목록) 화면 — 설계 rooms/design.md §2~§8 · design/functions.md §1.2 · F-RM-05 · F-RM-09
 * 요구: R-ROOMS-001 · 003 · 004 · 005 · R-CHAT-008(새 방 부재) · R-CHAT-010(마지막 본 방)
 * 목록 요청·자동 진입 판정은 useRoomsLoader 가 한다. 여기서는 조립과 렌더만 한다.
 * 토큰이 없으면 쓰기 UI(「+ 새 방」)를 렌더하지 않는다. S1 은 모든 방문자가 읽기 전용이라 TopBar 에 right 를 넘기지 않는다(숨김 금지).
 * 화면은 토큰을 읽지도 저장하지도 않는다.
 */
import { useEffect, useRef } from 'react'
import type { RoomSummary } from '@shared/types'
import { StateView } from '@/components/ui/StateView'
import { TopBar } from '@/components/ui/TopBar'
import type { Viewer } from '@/state/viewer'
import { RoomList } from './components/RoomList'
import { errorDetail, labels } from './labels'
import styles from './styles/RoomsScreen.module.css'
import { type RoomsLoad, useRoomsLoader } from './useRoomsLoader'

export type RoomsScreenProps = {
  /** S1 은 분기 대상이 없다. S2 에서 viewer.canWrite 가 TopBar.right 슬롯(새 방)을 가른다 */
  viewer: Viewer
  /** 시작 시 한 번만 쓰는 마지막 본 방 id */
  autoOpenRoomId: string | null
  onOpenRoom: (room: RoomSummary) => void
  onAutoOpenSettled: () => void
}

type ListAreaProps = {
  load: RoomsLoad
  onRetry: () => void
  onSelect: (room: RoomSummary) => void
}

/** 목록 영역. 판정 순서 error → loading → data → empty */
const ListArea = ({ load, onRetry, onSelect }: ListAreaProps) => {
  if (load.phase === 'error') {
    return (
      <StateView
        kind="error"
        message={labels.loadError}
        detail={errorDetail(load.error.code)}
        actionLabel={labels.retry}
        onAction={onRetry}
      />
    )
  }
  if (load.phase === 'loading') return <StateView kind="loading" message={labels.loading} />
  if (load.rooms.length === 0) return <StateView kind="empty" message={labels.empty} />
  return <RoomList rooms={load.rooms} onSelect={onSelect} />
}

export const RoomsScreen = ({
  autoOpenRoomId,
  onOpenRoom,
  onAutoOpenSettled,
}: RoomsScreenProps) => {
  const { load, loadRooms, retry } = useRoomsLoader({
    autoOpenRoomId,
    onOpenRoom,
    onAutoOpenSettled,
  })
  const titleRef = useRef<HTMLHeadingElement>(null)

  // F-RM-05: 마운트 시 h1 포커스 → 목록 요청
  useEffect(() => {
    titleRef.current?.focus()
    void loadRooms()
  }, [loadRooms])

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel}>
      <TopBar title={labels.screenTitle} titleRef={titleRef} />
      <section className={styles.list}>
        {/* F-RM-09: 행 선택 = onOpenRoom(그 RoomSummary) */}
        <ListArea load={load} onRetry={retry} onSelect={onOpenRoom} />
      </section>
    </main>
  )
}
