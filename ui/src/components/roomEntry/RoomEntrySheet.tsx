/**
 * RoomEntrySheet — 입장 시트(공용 PromptSheet 재사용). 설계 rooms/design/components.md §1.22 · design/lock.md F-RM-46 · §1.3
 * 요구: R-LOCK-004 · R-LOCK-006 · R-LOCK-008
 * 입력값은 PromptSheet 로컬 상태라 실패 문구가 바뀌어도 유지되고, 시트가 언마운트되면 사라진다(비밀번호 원문을 어디에도 두지 않는다).
 * key 를 방 id 로 둬 다른 방의 시트가 이전 입력을 물려받지 않게 한다. 입장은 이미 정해진 비밀번호를 넣는 곳이라 placeholder 가 없다.
 */
import { ROOM_ENTER_PASSWORD_MAX } from '@shared/limits'
import { PromptSheet } from '@/components/ui/PromptSheet'
import { isEnterPasswordValid } from '@/state/limits'
import { ROOM_ENTRY_TEXT, enterErrorText } from './roomEntryText'
import type { EntrySheet } from './useRoomEntry'

export type RoomEntrySheetProps = {
  sheet: NonNullable<EntrySheet>
  onSubmit: (password: string) => void
  onCancel: () => void
}

export const RoomEntrySheet = ({ sheet, onSubmit, onCancel }: RoomEntrySheetProps) => (
  <PromptSheet
    key={sheet.room.id}
    title={ROOM_ENTRY_TEXT.title}
    inputAriaLabel={ROOM_ENTRY_TEXT.inputAriaLabel}
    initialValue=""
    maxChars={ROOM_ENTER_PASSWORD_MAX}
    canSave={isEnterPasswordValid}
    saveLabel={ROOM_ENTRY_TEXT.submit}
    cancelLabel={ROOM_ENTRY_TEXT.cancel}
    onSave={onSubmit}
    onCancel={onCancel}
    isBusy={sheet.isBusy}
    errorText={sheet.error === null ? null : enterErrorText(sheet.error)}
    inputType="password"
  />
)
