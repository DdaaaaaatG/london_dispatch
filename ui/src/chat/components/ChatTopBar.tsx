/**
 * ChatTopBar(A) — 설계 chat/design.md §2.1 · §3.1 · design/functions.md F-CH-01 · 요구 R-CHAT-001 · R-CHAT-013
 * 공용 TopBar(variant room)에 ‹ 뒤로 · 방 제목 · 생성일(createdAt, updatedAt 아님)을 조립한다.
 * 토큰 분기는 right 슬롯을 넘기지 않는 것으로 한다. S1 은 ⋯ 메뉴가 없어 right 를 넘기지 않는다(미렌더).
 */
import type { Ref } from 'react'
import type { RoomSummary } from '@shared/types'
import { IconButton } from '@/components/ui/IconButton'
import { TopBar } from '@/components/ui/TopBar'
import { formatMonthDay, toIsoDate } from '@/components/utils/formatDate'
import { labels } from '@/chat/labels'

export type ChatTopBarProps = {
  room: RoomSummary
  onBack: () => void
  /** 마운트 시 포커스 대상 */
  backButtonRef: Ref<HTMLButtonElement>
}

export const ChatTopBar = ({ room, onBack, backButtonRef }: ChatTopBarProps) => {
  const createdText = formatMonthDay(room.createdAt)
  return (
    <TopBar
      variant="room"
      title={room.title}
      subtitle={{
        text: createdText,
        dateTime: toIsoDate(room.createdAt),
        ariaLabel: labels.createdAtAriaLabel(createdText),
      }}
      left={
        <IconButton
          icon="back"
          ariaLabel={labels.backAriaLabel}
          onClick={onBack}
          buttonRef={backButtonRef}
        />
      }
    />
  )
}
