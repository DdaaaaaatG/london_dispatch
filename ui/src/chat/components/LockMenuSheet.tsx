/**
 * LockMenuSheet(잠긴 방의 ⋯ → 「잠금」 시트) — 설계 chat/design/lock.md LK §0.3 · §1.4 · F-CH-82 · 요구 R-CHAT-001 🔒(S6 개정) · R-LOCK-002
 * 머리 줄 "잠금 · 방 제목" 아래에 비밀번호 바꾸기 · 잠금 풀기 · 취소. 「잠금 풀기」는 default 톤이다(D-47, 데이터 삭제가 아니라 danger 가 아님).
 * 방 메뉴(RoomMenuSheet)와 같은 틀이지만 같은 화면 안 2회뿐이라 추출하지 않는다(LK §11).
 */
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'
import { labels } from '@/chat/labels'
import styles from './MenuSheets.module.css'

export type LockMenuSheetProps = {
  roomTitle: string
  /** 「비밀번호 바꾸기」 시트로(F-CH-75) */
  onChangePassword: () => void
  /** 「잠금을 풀까요?」 확인으로(F-CH-75) */
  onUnlock: () => void
  onClose: () => void
}

export const LockMenuSheet = ({
  roomTitle,
  onChangePassword,
  onUnlock,
  onClose,
}: LockMenuSheetProps) => (
  <BottomSheet
    ariaLabel={labels.lockMenuAriaLabel}
    header={<p className={styles.menuHeader}>{labels.lockMenuHeader(roomTitle)}</p>}
    onClose={onClose}
  >
    <SheetItem label={labels.changePassword} onSelect={onChangePassword} />
    <SheetItem label={labels.unlock} onSelect={onUnlock} />
    <SheetItem label={labels.cancel} onSelect={onClose} />
  </BottomSheet>
)
