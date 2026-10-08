/**
 * rooms(방 목록) 화면 — 설계 rooms/design.md §2~§8 · §10 · design/functions.md §1.2 · F-RM-05 · F-RM-09
 * 요구: R-ROOMS-001 · 002 · 003 · 004 · 005 · R-CHAT-008(새 방 렌더 쌍) · R-CHAT-010(마지막 본 방) · R-CHAT-011(생성 실패 안내) · R-LOCK-001 · 003 · 004 · 005 · 006
 * 목록 요청·자동 진입 판정은 useRoomsLoader, 새 방 쓰기 UI 는 useNewRoomUi, (S6) 행 탭의 방 접근 판정·입장 시트는 useRoomEntry 가 한다. 여기서는 조립과 렌더만 한다.
 * (S6) 입장 시트는 쓰기 UI 가 아니라 토큰과 무관하게 렌더한다(읽기 전용도 비밀번호를 넣으면 읽을 수 있다).
 * 토큰이 없으면(viewer.canWrite === false) 쓰기 UI(「+ 새 방」 · 입력 행)를 렌더하지 않는다(숨김 금지).
 * 화면은 토큰을 읽지도 저장하지도 않는다. 인증 실패는 onAuthFailure 로 App 에 알려 읽기 전용으로 전환된다.
 * S3c: 갠홈 주인(isOwner)이면 상단 바 「+ 새 방」 왼쪽에 ⚙(설정 진입)를 렌더한다 — 토큰 없음·비주인·판정 실패면 DOM 에 없다(숨김 금지).
 * 설정 화면에서 돌아올 때의 안내(entryNotice)는 마운트 때 토스트로 1회 띄운다(useEntryNotice). 요구 R-SET-009 · R-SET-010.
 */
import { useEffect, useRef } from 'react'
import type { RoomSummary } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { StateView } from '@/components/ui/StateView'
import { Toast } from '@/components/ui/Toast'
import type { ToastProps } from '@/components/ui/Toast'
import { TopBar } from '@/components/ui/TopBar'
import { RoomEntrySheet, useRoomEntry } from '@/components/roomEntry'
import type { UseRoomEntryResult } from '@/components/roomEntry'
import type { Viewer } from '@/state/viewer'
import { NewRoomRow } from './components/NewRoomRow'
import { RoomList } from './components/RoomList'
import { errorDetail, labels } from './labels'
import styles from './styles/RoomsScreen.module.css'
import { useEntryNotice } from './useEntryNotice'
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
  /** (S3c) 갠홈 주인 여부(App 판정). viewer.canWrite 와 함께 ⚙ 렌더 조건이다. 기본 false */
  isOwner?: boolean
  /** (S3c) ⚙ 클릭 → 설정 화면. 없으면 ⚙ 를 렌더하지 않는다 */
  onOpenSettings?: () => void
  /** (S3c) 설정 화면에서 돌아올 때 마운트 1회 띄울 안내 */
  entryNotice?: ToastProps | null
  /** (S3c) 안내를 띄웠다(App 이 entryNotice 를 비운다) */
  onEntryNoticeShown?: () => void
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

/** 상단 바 오른쪽 「+ 새 방」(S3c: 주인이면 그 왼쪽에 ⚙). 토큰이 없으면 호출 쪽이 렌더하지 않는다 */
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

type TopActionsProps = {
  newRoom: NewRoomUi
  /** 있을 때만(주인 + 콜백) ⚙ 를 렌더한다. 판정이 늦게 끝나도 「+ 새 방」은 오른쪽 끝 그대로다 */
  onOpenSettings: (() => void) | undefined
}

/** 상단 바 오른쪽 줄: ⚙(설정) → 「+ 새 방」. 쓰기 가능이면 줄 자체는 늘 있어 새 방 버튼의 DOM 위치가 안 바뀐다 */
const TopActions = ({ newRoom, onOpenSettings }: TopActionsProps) => (
  <div className={styles.topActions}>
    {onOpenSettings && (
      <IconButton icon="settings" ariaLabel={labels.settingsAriaLabel} onClick={onOpenSettings} />
    )}
    <NewRoomButton newRoom={newRoom} />
  </div>
)

/** B 새 방 입력 행. 「+ 새 방」을 눌러 열렸을 때만 렌더한다 */
const NewRoomSection = ({ newRoom }: { newRoom: NewRoomUi }) =>
  newRoom.create.isOpen && (
    <NewRoomRow
      title={newRoom.create.title}
      onChangeTitle={newRoom.changeTitle}
      password={newRoom.create.password}
      onChangePassword={newRoom.changePassword}
      onSubmit={newRoom.submitCreate}
      onCancel={newRoom.cancelCreate}
      isSubmitting={newRoom.create.isSubmitting}
      inputRef={newRoom.titleInputRef}
    />
  )

/** 입장 시트(S6). 쓰기 UI 가 아니라서 토큰과 무관하게 렌더한다 — 시트가 닫혀 있으면 아무것도 그리지 않는다 */
const EntryLayer = ({ entry }: { entry: UseRoomEntryResult }) =>
  entry.sheet !== null && (
    <RoomEntrySheet
      sheet={entry.sheet}
      onSubmit={entry.submitPassword}
      onCancel={entry.cancelEntry}
    />
  )

type RoomsStateOptions = Pick<
  RoomsScreenProps,
  'viewer' | 'autoOpenRoomId' | 'onOpenRoom' | 'onAutoOpenSettled' | 'onAuthFailure'
>

/**
 * 목록 요청 · 방 접근 판정(S6) · 새 방 UI 를 묶는다(RoomsScreen 50줄 한계).
 * 호출 순서가 의존 순서다: 목록(retry 가 필요) → 방 접근 판정 → 새 방 UI(입장 시트 열림을 받는다).
 */
const useRoomsScreen = (options: RoomsStateOptions) => {
  const { viewer, autoOpenRoomId, onOpenRoom, onAutoOpenSettled, onAuthFailure } = options
  const { load, loadRooms, retry } = useRoomsLoader({
    autoOpenRoomId,
    onOpenRoom,
    onAutoOpenSettled,
  })
  // F-RM-47: 행 선택은 방 접근 판정을 거친다. 방이 사라졌으면(NOT_FOUND) 목록을 다시 받는다(F-RM-48)
  const entry = useRoomEntry({
    canWrite: viewer.canWrite,
    onEntered: onOpenRoom,
    onRoomGone: retry,
  })
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isEntrySheetOpen = entry.sheet !== null
  const newRoom = useNewRoomUi({ viewer, titleRef, onOpenRoom, onAuthFailure, isEntrySheetOpen })

  // F-RM-05: 마운트 시 h1 포커스 → 목록 요청
  useEffect(() => {
    titleRef.current?.focus()
    void loadRooms()
  }, [loadRooms])

  return { load, retry, entry, newRoom, titleRef }
}

export const RoomsScreen = ({
  viewer,
  autoOpenRoomId,
  onOpenRoom,
  onAutoOpenSettled,
  onAuthFailure,
  isOwner = false,
  onOpenSettings,
  entryNotice,
  onEntryNoticeShown,
}: RoomsScreenProps) => {
  const { load, retry, entry, newRoom, titleRef } = useRoomsScreen({
    viewer,
    autoOpenRoomId,
    onOpenRoom,
    onAutoOpenSettled,
    onAuthFailure,
  })
  const { toast } = newRoom
  useEntryNotice({ entryNotice, onEntryNoticeShown, showToast: newRoom.showToast })

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel}>
      <TopBar
        title={labels.screenTitle}
        titleRef={titleRef}
        right={
          viewer.canWrite ? (
            <TopActions newRoom={newRoom} onOpenSettings={isOwner ? onOpenSettings : undefined} />
          ) : undefined
        }
      />
      {viewer.canWrite && <NewRoomSection newRoom={newRoom} />}
      <section className={styles.list}>
        {/* F-RM-09 · F-RM-47: 행 선택 = 방 접근 판정(entry.requestEntry) */}
        <ListArea load={load} onRetry={retry} onSelect={entry.requestEntry} />
      </section>
      <EntryLayer entry={entry} />
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} />}
    </main>
  )
}
