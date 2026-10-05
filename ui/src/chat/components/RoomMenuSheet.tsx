/**
 * RoomMenuSheet(⋯ 방 메뉴) — 설계 chat/design/components.md §2.9 · 구성안 §2-2 · 요구 R-CHAT-001
 * 머리 줄 "방 메뉴 · 방 제목" 아래에 이름 변경 · 방 삭제(danger) · 취소.
 * 장기기억 항목은 S4 에서 이름 변경과 방 삭제 사이에 들어온다(지금은 렌더하지 않는다).
 */
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'
import { labels } from '@/chat/labels'
import styles from './MenuSheets.module.css'

export type RoomMenuSheetProps = {
  roomTitle: string
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

export const RoomMenuSheet = ({ roomTitle, onRename, onDelete, onClose }: RoomMenuSheetProps) => (
  <BottomSheet
    ariaLabel={labels.roomMenuAriaLabel}
    header={<p className={styles.menuHeader}>{labels.roomMenuHeader(roomTitle)}</p>}
    onClose={onClose}
  >
    <SheetItem label={labels.rename} onSelect={onRename} />
    <SheetItem label={labels.deleteRoom} tone="danger" onSelect={onDelete} />
    <SheetItem label={labels.cancel} onSelect={onClose} />
  </BottomSheet>
)
