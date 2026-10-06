/**
 * ChatSheets(시트 스위치) — 설계 chat/design/components.md §2.10 · 요구 R-CHAT-001 · R-CHAT-007
 * sheet.kind 에 따라 시트 하나만 렌더한다: 말풍선 메뉴 · 메시지 삭제 확인 · 방 메뉴 · 이름 변경 · 방 삭제 확인.
 * ChatScreen 이 viewer.canWrite && sheet !== null 일 때만 이 컴포넌트를 렌더한다(토큰 없으면 시트 DOM 없음).
 * 이름 변경 실패 문구(errorText)가 바뀌어도 같은 PromptSheet 인스턴스라 입력값이 유지된다.
 */
import type { Message, RoomSummary } from '@shared/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PromptSheet } from '@/components/ui/PromptSheet'
import { labels } from '@/chat/labels'
import { ROOM_TITLE_MAX_CHARS, isRoomTitleValid } from '@/state/limits'
import type { MessageWrite } from '@/state/chat'
import { MessageMenuSheet } from './MessageMenuSheet'
import { RoomMenuSheet } from './RoomMenuSheet'

export type ChatSheet =
  | { kind: 'messageMenu'; message: Message; canRegenerate: boolean }
  | { kind: 'confirmDeleteMessage'; message: Message }
  | { kind: 'roomMenu' }
  | { kind: 'rename'; errorText: string | null }
  | { kind: 'confirmDeleteRoom' }

export type ChatSheetsProps = {
  sheet: ChatSheet
  room: RoomSummary
  /** 진행 중인 메시지 쓰기 */
  writing: MessageWrite | null
  /** 방 이름 변경·삭제 요청 중 */
  roomBusy: 'rename' | 'delete' | null
  onClose: () => void
  onStartEdit: (message: Message) => void
  onRegenerate: (message: Message) => void
  onAskDeleteMessage: (message: Message) => void
  onConfirmDeleteMessage: (message: Message) => void
  onAskRename: () => void
  onSaveRename: (title: string) => void
  onAskDeleteRoom: () => void
  onConfirmDeleteRoom: () => void
}

/** 메시지 쪽 시트 두 종 */
const renderMessageSheet = (
  sheet: Extract<ChatSheet, { kind: 'messageMenu' | 'confirmDeleteMessage' }>,
  props: ChatSheetsProps,
) => {
  const { message } = sheet
  if (sheet.kind === 'messageMenu') {
    return (
      <MessageMenuSheet
        message={message}
        isWriteBusy={props.writing !== null}
        canRegenerate={sheet.canRegenerate}
        onEdit={() => props.onStartEdit(message)}
        onRegenerate={() => props.onRegenerate(message)}
        onDelete={() => props.onAskDeleteMessage(message)}
        onClose={props.onClose}
      />
    )
  }
  return (
    <ConfirmDialog
      title={labels.deleteMessageTitle}
      message={labels.deleteMessageBody}
      confirmLabel={labels.delete}
      cancelLabel={labels.cancel}
      onConfirm={() => props.onConfirmDeleteMessage(message)}
      onCancel={props.onClose}
      isBusy={props.writing?.kind === 'delete'}
    />
  )
}

/** 방 쪽 시트 세 종 */
const renderRoomSheet = (
  sheet: Extract<ChatSheet, { kind: 'roomMenu' | 'rename' | 'confirmDeleteRoom' }>,
  props: ChatSheetsProps,
) => {
  const { room } = props
  if (sheet.kind === 'roomMenu') {
    return (
      <RoomMenuSheet
        roomTitle={room.title}
        onRename={props.onAskRename}
        onDelete={props.onAskDeleteRoom}
        onClose={props.onClose}
      />
    )
  }
  if (sheet.kind === 'rename') {
    return (
      <PromptSheet
        title={labels.renameTitle}
        inputAriaLabel={labels.renameInputAriaLabel}
        initialValue={room.title}
        maxChars={ROOM_TITLE_MAX_CHARS}
        canSave={value => isRoomTitleValid(value) && value.trim() !== room.title}
        saveLabel={labels.save}
        cancelLabel={labels.cancel}
        onSave={props.onSaveRename}
        onCancel={props.onClose}
        isBusy={props.roomBusy === 'rename'}
        errorText={sheet.errorText}
      />
    )
  }
  return (
    <ConfirmDialog
      title={labels.deleteRoomTitle}
      message={labels.deleteRoomBody}
      confirmLabel={labels.delete}
      cancelLabel={labels.cancel}
      onConfirm={props.onConfirmDeleteRoom}
      onCancel={props.onClose}
      isBusy={props.roomBusy === 'delete'}
    />
  )
}

export const ChatSheets = (props: ChatSheetsProps) => {
  const { sheet } = props
  if (sheet.kind === 'messageMenu' || sheet.kind === 'confirmDeleteMessage') {
    return renderMessageSheet(sheet, props)
  }
  return renderRoomSheet(sheet, props)
}
