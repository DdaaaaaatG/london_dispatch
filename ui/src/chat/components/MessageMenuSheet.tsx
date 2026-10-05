/**
 * MessageMenuSheet(말풍선 메뉴) — 설계 chat/design/components.md §2.8 · 구성안 §2-1 · 요구 R-CHAT-007 · R-LLM-002
 * 머리 줄 "이름 · 시각  "발췌"" 아래에 수정 · 삭제(danger) · 취소. 쓰기 대기 중(isWriteBusy)이면 수정·삭제가 비활성이다.
 * 재작성 항목은 S3 에서 수정과 삭제 사이에 들어온다(지금은 렌더하지 않는다).
 * 이름: 캐릭터 = CHARACTERS 짧은 이름 · 유저 = authorName(없으면 이름 없음) · OOC = [지시]. 발췌: 코드 포인트 20자 넘으면 앞 20자 + …
 */
import { CHARACTERS } from '@shared/characters'
import type { Message } from '@shared/types'
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'
import { formatTime } from '@/components/utils/formatDate'
import { labels } from '@/chat/labels'
import { bubbleVariantOf } from './Bubble'
import styles from './MenuSheets.module.css'

export type MessageMenuSheetProps = {
  message: Message
  /** state.writing !== null */
  isWriteBusy: boolean
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

const EXCERPT_MAX_CHARS = 20

/** 머리 줄에 쓰는 이름 */
const nameOf = (message: Message): string => {
  const variant = bubbleVariantOf(message)
  if (variant === 'ooc') return labels.oocPrefix
  if (variant === 'user') return message.authorName ?? labels.unknownAuthor
  return CHARACTERS[variant].shortName
}

/** 본문 앞부분. 코드 포인트 기준 20자를 넘으면 자르고 … 를 붙인다 */
const excerptOf = (text: string): string => {
  const chars = Array.from(text)
  return chars.length > EXCERPT_MAX_CHARS ? `${chars.slice(0, EXCERPT_MAX_CHARS).join('')}…` : text
}

export const MessageMenuSheet = ({
  message,
  isWriteBusy,
  onEdit,
  onDelete,
  onClose,
}: MessageMenuSheetProps) => (
  <BottomSheet
    ariaLabel={labels.messageMenuAriaLabel}
    header={
      <p className={styles.menuHeader}>
        {labels.messageMenuHeader(
          nameOf(message),
          formatTime(message.createdAt),
          excerptOf(message.text),
        )}
      </p>
    }
    onClose={onClose}
  >
    <SheetItem label={labels.edit} onSelect={onEdit} isDisabled={isWriteBusy} />
    <SheetItem label={labels.delete} tone="danger" onSelect={onDelete} isDisabled={isWriteBusy} />
    <SheetItem label={labels.cancel} onSelect={onClose} />
  </BottomSheet>
)
