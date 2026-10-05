/**
 * ChatTopBar(A) — 설계 chat/design.md §2.1 · §2.2 · §3.1 · design/components.md §2.0 · F-CH-01 · 요구 R-CHAT-001 · R-CHAT-008 · R-CHAT-013
 * 공용 TopBar(variant room)에 ‹ 뒤로 · 방 제목 · 생성일(createdAt, updatedAt 아님)을 조립한다.
 * S2: onOpenMenu 가 있을 때만 오른쪽에 ⋯ 방 메뉴 버튼을 렌더한다(없으면 right 슬롯 미렌더 = 토큰 없는 방문자).
 * 쓰기 대기 중에는 isMenuDisabled 로 ⋯ 를 비활성한다(design §11.2 D-10).
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
  /** 있으면 right = ⋯ 버튼, 없으면 right 미렌더 */
  onOpenMenu?: (() => void) | undefined
  /** 방 메뉴 시트를 닫은 뒤 포커스 복귀 대상 */
  menuButtonRef?: Ref<HTMLButtonElement> | undefined
  /** 쓰기 대기 중 ⋯ 비활성 */
  isMenuDisabled?: boolean
}

export const ChatTopBar = ({
  room,
  onBack,
  backButtonRef,
  onOpenMenu,
  menuButtonRef,
  isMenuDisabled = false,
}: ChatTopBarProps) => {
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
      right={
        onOpenMenu ? (
          <IconButton
            icon="more"
            ariaLabel={labels.moreAriaLabel}
            onClick={onOpenMenu}
            buttonRef={menuButtonRef}
            isDisabled={isMenuDisabled}
          />
        ) : undefined
      }
    />
  )
}
