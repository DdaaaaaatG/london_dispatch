/**
 * 공용 ConfirmDialog — 설계 rooms/design/components.md §1.16 · 요구 R-CHAT-001 · R-CHAT-007
 * 파괴 조작(메시지 삭제·방 삭제) 확인. BottomSheet(role=alertdialog) 안에 제목 · 설명 · 버튼 줄(취소 왼쪽, 확인 오른쪽 danger).
 * 첫 포커스는 취소다. window.confirm 은 쓰지 않는다. 요청 중(isBusy)이면 두 버튼 disabled, Esc·덮개 닫힘도 막는다.
 * 확인 버튼의 danger 클래스 키는 Button variant 값 그대로다. 문구는 props 로만 받는다(§1.9).
 */
import { useRef } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import styles from './ConfirmDialog.module.css'

export type ConfirmDialogProps = {
  /** 한 줄 질문 */
  title: string
  /** 결과 설명 */
  message: string
  /** 파괴 버튼(오른쪽, danger) */
  confirmLabel: string
  /** 취소(왼쪽, secondary) */
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** 요청 중: 두 버튼 disabled, Esc·덮개 닫힘 막음 */
  isBusy?: boolean
}

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isBusy = false,
}: ConfirmDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <BottomSheet
      role="alertdialog"
      ariaLabel={title}
      onClose={onCancel}
      isDismissDisabled={isBusy}
      initialFocusRef={cancelRef}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button
          size="lg"
          variant="secondary"
          isDisabled={isBusy}
          onClick={onCancel}
          buttonRef={cancelRef}
        >
          {cancelLabel}
        </Button>
        <Button size="lg" variant="danger" isDisabled={isBusy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}
