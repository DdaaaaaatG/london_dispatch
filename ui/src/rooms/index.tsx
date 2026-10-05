/**
 * rooms(방 목록) 화면 — 설계 rooms/design.md §2~§8 · §10 · design/functions.md §1.2 · F-RM-05 · F-RM-09
 * 요구: R-ROOMS-001 · 002 · 003 · 004 · 005 · R-CHAT-008(새 방 렌더 쌍) · R-CHAT-010(마지막 본 방) · R-CHAT-011(생성 실패 안내)
 * 목록 요청·자동 진입 판정은 useRoomsLoader, 새 방 쓰기 UI 는 useNewRoomUi 가 한다. 여기서는 조립과 렌더만 한다.
 * 토큰이 없으면(viewer.canWrite === false) 쓰기 UI(「+ 새 방」 · 입력 행)를 렌더하지 않는다(숨김 금지).
 * 화면은 토큰을 읽지도 저장하지도 않는다. 인증 실패는 onAuthFailure 로 App 에 알려 읽기 전용으로 전환된다.
 */
import { useEffect, useRef } from 'react'
import type { RoomSummary } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { StateView } from '@/components/ui/StateView'
import { Toast } from '@/components/ui/Toast'
import { TopBar } from '@/components/ui/TopBar'
import type { Viewer } from '@/state/viewer'
import { NewRoomRow } from './components/NewRoomRow'
import { RoomList } from './components/RoomList'
import { errorDetail, labels } from './labels'
import styles from './styles/RoomsScreen.module.css'
import { type NewRoomUi, useNewRoomUi } from './useNewRoomUi'
import { type RoomsLoad, useRoomsLoader } from './useRoomsLoader'

export type RoomsScreenProps = {
  /** viewer.canWrite 가 TopBar.right 슬롯(새 방)과 입력 행 렌더를 가른다 */
  viewer: Viewer
  /** 시작 시 한 번만 쓰는 마지막 본 방 id */
  autoOpenRoomId: string | null
  /** 방을 골랐거나 새로 만들었다 */
  onOpenRoom: (room: RoomSummary) => void
  onAutoOpenSettled: () => void
  /** 쓰기 결과가 인증 실패다(App 이 읽기 전용으로 전환한다) */
  onAuthFailure: () => void
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

/** 상단 바 오른쪽 「+ 새 방」. 토큰이 없으면 호출 쪽이 렌더하지 않는다 */
const NewRoomButton = ({ newRoom }: { newRoom: NewRoomUi }) => (
  <Button
    variant="primary"
    ariaLabel={labels.newRoomAriaLabel}
    buttonRef={newRoom.newRoomButtonRef}
    onClick={newRoom.openCreate}
  >
    {labels.newRoom}
  </Button>
)

/** B 새 방 입력 행. 「+ 새 방」을 눌러 열렸을 때만 렌더한다 */
const NewRoomSection = ({ newRoom }: { newRoom: NewRoomUi }) =>
  newRoom.create.isOpen && (
    <NewRoomRow
      title={newRoom.create.title}
      onChangeTitle={newRoom.changeTitle}
      onSubmit={newRoom.submitCreate}
      onCancel={newRoom.cancelCreate}
      isSubmitting={newRoom.create.isSubmitting}
      inputRef={newRoom.titleInputRef}
    />
  )

export const RoomsScreen = ({
  viewer,
  autoOpenRoomId,
  onOpenRoom,
  onAutoOpenSettled,
  onAuthFailure,
}: RoomsScreenProps) => {
  const { load, loadRooms, retry } = useRoomsLoader({
    autoOpenRoomId,
    onOpenRoom,
    onAutoOpenSettled,
  })
  const titleRef = useRef<HTMLHeadingElement>(null)
  const newRoom = useNewRoomUi({ viewer, titleRef, onOpenRoom, onAuthFailure })
  const { toast } = newRoom

  // F-RM-05: 마운트 시 h1 포커스 → 목록 요청
  useEffect(() => {
    titleRef.current?.focus()
    void loadRooms()
  }, [loadRooms])

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel}>
      <TopBar
        title={labels.screenTitle}
        titleRef={titleRef}
        right={viewer.canWrite ? <NewRoomButton newRoom={newRoom} /> : undefined}
      />
      {viewer.canWrite && <NewRoomSection newRoom={newRoom} />}
      <section className={styles.list}>
        {/* F-RM-09: 행 선택 = onOpenRoom(그 RoomSummary) */}
        <ListArea load={load} onRetry={retry} onSelect={onOpenRoom} />
      </section>
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} />}
    </main>
  )
}
