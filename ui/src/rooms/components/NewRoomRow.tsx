/**
 * NewRoomRow(B) — 설계 rooms/design/components.md §2.4 · 구성안 §1 B · 요구 R-ROOMS-002 · R-ROOM-002
 * 「+ 새 방」을 누른 뒤에만 보이는 52px 한 줄: 제목 입력(n/60 카운터) · 취소 · 만들기.
 * 요청 중(isSubmitting)이면 입력은 읽기 전용, 두 버튼은 비활성이다. 한도를 넘으면 만들기가 비활성이다.
 * Enter · Esc 도 입력에서 만들기 · 취소로 이어지지만, 유효성·중복은 호출 쪽(useCreateRoom)이 다시 막는다.
 * 토큰이 없으면 이 컴포넌트를 렌더하지 않는다(호출 쪽 분기, 숨김 금지).
 */
import type { Ref } from 'react'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { labels } from '@/rooms/labels'
import { ROOM_TITLE_MAX_CHARS, isRoomTitleValid } from '@/state/limits'
import styles from './NewRoomRow.module.css'

export type NewRoomRowProps = {
  title: string
  onChangeTitle: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  inputRef: Ref<HTMLInputElement>
}

export const NewRoomRow = ({
  title,
  onChangeTitle,
  onSubmit,
  onCancel,
  isSubmitting,
  inputRef,
}: NewRoomRowProps) => (
  <div className={styles.root} role="group" aria-label={labels.newRoomGroupAriaLabel}>
    <TextInput
      value={title}
      onChange={onChangeTitle}
      ariaLabel={labels.newRoomInputAriaLabel}
      placeholder={labels.newRoomPlaceholder}
      maxChars={ROOM_TITLE_MAX_CHARS}
      inputRef={inputRef}
      onEnter={onSubmit}
      onEscape={onCancel}
      isReadOnly={isSubmitting}
    />
    <Button size="sm" variant="secondary" isDisabled={isSubmitting} onClick={onCancel}>
      {labels.cancel}
    </Button>
    <Button
      size="sm"
      variant="primary"
      isDisabled={isSubmitting || !isRoomTitleValid(title)}
      onClick={onSubmit}
    >
      {labels.create}
    </Button>
  </div>
)
