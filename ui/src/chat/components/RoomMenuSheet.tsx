/**
 * RoomMenuSheet(⋯ 방 메뉴) — 설계 chat/design/components.md §2.9 · design/memory.md ME §1.4 · 구성안 §2-2 · 요구 R-CHAT-001 🔒 · R-CHAT-012 🔒
 * 머리 줄 "방 메뉴 · 방 제목" 아래에 이름 변경 · 장기기억(S4) · 잠금(S6, design/lock.md LK §1.5) · 방 삭제(danger) · 취소(순서 확정).
 */
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'
import { labels } from '@/chat/labels'
import styles from './MenuSheets.module.css'

export type RoomMenuSheetProps = {
  roomTitle: string
  onRename: () => void
  /** S4: 장기기억 시트 열기(F-CH-53) */
  onMemory: () => void
  /** S6: 잠금(안 잠긴 방 = 걸기 시트, 잠긴 방 = 잠금 시트, F-CH-74) */
  onLock: () => void
  onDelete: () => void
  onClose: () => void
}

export const RoomMenuSheet = ({
  roomTitle,
  onRename,
  onMemory,
  onLock,
  onDelete,
  onClose,
}: RoomMenuSheetProps) => (
  <BottomSheet
    ariaLabel={labels.roomMenuAriaLabel}
    header={<p className={styles.menuHeader}>{labels.roomMenuHeader(roomTitle)}</p>}
    onClose={onClose}
  >
    <SheetItem label={labels.rename} onSelect={onRename} />
    <SheetItem label={labels.memory} onSelect={onMemory} />
    <SheetItem label={labels.lock} onSelect={onLock} />
    <SheetItem label={labels.deleteRoom} tone="danger" onSelect={onDelete} />
    <SheetItem label={labels.cancel} onSelect={onClose} />
  </BottomSheet>
)
