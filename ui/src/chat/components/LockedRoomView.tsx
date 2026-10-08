/**
 * LockedRoomView(입장 재요구 판) — 설계 chat/design/lock.md LK §0.4 · §1.3 · F-CH-67 · 요구 R-LOCK-004 · R-LOCK-006 · R-CHAT-001
 * ROOM_LOCKED 를 받은 뒤의 판: 상단 바(‹ · 제목 · 생성일, ⋯ 없음) + 「잠긴 방입니다」 + (토큰 없음이면 열람 안내) + 입장 시트(필요할 때).
 * 하단 바와 ⋯ 은 토큰과 무관하게 렌더하지 않는다(D-46). 말풍선 DOM 도 없다. 스타일은 ChatScreen.module.css 를 그대로 쓴다.
 * 포커스(LK §1.3): 마운트 순간 입장 시트가 이미 열려 있으면 건드리지 않는다(시트 입력 포커스 유지). 시트가 없을 때만 ‹ 로 —
 * 시트가 나중에 열리면 BottomSheet 가 ‹ 를 복귀 대상으로 기억한다.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { RoomSummary } from '@shared/types'
import { RoomEntrySheet } from '@/components/roomEntry'
import { StateView } from '@/components/ui/StateView'
import type { Viewer } from '@/state/viewer'
import { labels } from '@/chat/labels'
import type { UseRoomLockGateResult } from '@/chat/useRoomLockGate'
import styles from '../styles/ChatScreen.module.css'
import { ChatTopBar } from './ChatTopBar'
import { ReadOnlyNotice } from './ReadOnlyNotice'

export type LockedRoomViewProps = {
  room: RoomSummary
  viewer: Viewer
  gate: UseRoomLockGateResult
}

export const LockedRoomView = ({ room, viewer, gate }: LockedRoomViewProps) => {
  const backButtonRef = useRef<HTMLButtonElement>(null)
  // 마운트 순간의 시트 유무(값은 바뀌지 않는다). 열려 있었으면 시트 입력이 포커스를 가진다
  const [isSheetOpenAtMount] = useState(gate.sheet !== null)
  useLayoutEffect(() => {
    if (!isSheetOpenAtMount) backButtonRef.current?.focus()
  }, [isSheetOpenAtMount])

  return (
    <main className={styles.root} aria-label={labels.screenAriaLabel(room.title)}>
      <ChatTopBar room={room} onBack={gate.back} backButtonRef={backButtonRef} />
      <section className={styles.history}>
        <StateView kind="empty" message={labels.lockedRoom} />
      </section>
      {!viewer.canWrite && <ReadOnlyNotice text={labels.readOnlyNotice} />}
      {gate.sheet && (
        <RoomEntrySheet
          sheet={gate.sheet}
          onSubmit={gate.submitPassword}
          onCancel={gate.cancelLockedEntry}
        />
      )}
    </main>
  )
}
