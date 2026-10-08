/**
 * NewRoomRow(B) — 설계 rooms/design/components.md §2.4 · design/lock.md §1.1 · 구성안 ui-layout-04 §2 · 요구 R-ROOMS-002 · R-ROOM-002 · R-LOCK-001
 * 「+ 새 방」을 누른 뒤에만 보이는 2줄(높이 96): B1 제목 입력(n/60) + 취소 / B2 비밀번호 입력(n/32, 선택) + 만들기.
 * 두 버튼 최소 폭 72 로 두 입력의 오른쪽 끝이 한 세로선에 선다. 제목 Enter = 비밀번호 칸으로 포커스(제출 안 함), 비밀번호 Enter = 만들기.
 * 요청 중(isSubmitting)이면 입력은 읽기 전용, 두 버튼은 비활성이다. 제목이 무효이거나 비밀번호가 1~3자·33자 이상이면 만들기가 비활성이다.
 * 유효성·중복 제출은 호출 쪽(useCreateRoom)이 다시 막는다. 토큰이 없으면 이 컴포넌트를 렌더하지 않는다(호출 쪽 분기, 숨김 금지).
 */
import { useRef } from 'react'
import type { Ref } from 'react'
import { ROOM_PASSWORD_MAX } from '@shared/limits'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { labels } from '@/rooms/labels'
import { ROOM_TITLE_MAX_CHARS, isRoomPasswordValid, isRoomTitleValid } from '@/state/limits'
import styles from './NewRoomRow.module.css'

export type NewRoomRowProps = {
  title: string
  onChangeTitle: (value: string) => void
  /** (S6) 비밀번호 원문. 빈칸이면 잠그지 않는다 */
  password: string
  onChangePassword: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  /** 제목 입력(포커스 대상) */
  inputRef: Ref<HTMLInputElement>
}

type TitleLineProps = Pick<
  NewRoomRowProps,
  'title' | 'onChangeTitle' | 'onCancel' | 'isSubmitting' | 'inputRef'
> & { onNext: () => void }

/** B1: 제목 입력 + 취소. 제목 Enter 는 제출하지 않고 다음(비밀번호 칸)으로 간다 */
const TitleLine = ({
  title,
  onChangeTitle,
  onCancel,
  isSubmitting,
  inputRef,
  onNext,
}: TitleLineProps) => (
  <div className={styles.line}>
    <TextInput
      value={title}
      onChange={onChangeTitle}
      ariaLabel={labels.newRoomInputAriaLabel}
      placeholder={labels.newRoomPlaceholder}
      maxChars={ROOM_TITLE_MAX_CHARS}
      inputRef={inputRef}
      onEnter={onNext}
      onEscape={onCancel}
      isReadOnly={isSubmitting}
    />
    <div className={styles.action}>
      <Button size="md" variant="secondary" isDisabled={isSubmitting} onClick={onCancel}>
        {labels.cancel}
      </Button>
    </div>
  </div>
)

type PasswordLineProps = Pick<
  NewRoomRowProps,
  'password' | 'onChangePassword' | 'onSubmit' | 'onCancel' | 'isSubmitting'
> & { canCreate: boolean; inputRef: Ref<HTMLInputElement> }

/** B2: 비밀번호 입력(선택) + 만들기. 비밀번호 Enter 는 만들기와 같다 */
const PasswordLine = ({
  password,
  onChangePassword,
  onSubmit,
  onCancel,
  isSubmitting,
  canCreate,
  inputRef,
}: PasswordLineProps) => (
  <div className={styles.line}>
    <TextInput
      type="password"
      value={password}
      onChange={onChangePassword}
      ariaLabel={labels.newRoomPasswordAriaLabel}
      placeholder={labels.newRoomPasswordPlaceholder}
      maxChars={ROOM_PASSWORD_MAX}
      inputRef={inputRef}
      onEnter={onSubmit}
      onEscape={onCancel}
      isReadOnly={isSubmitting}
    />
    <div className={styles.action}>
      <Button size="md" variant="primary" isDisabled={!canCreate} onClick={onSubmit}>
        {labels.create}
      </Button>
    </div>
  </div>
)

export const NewRoomRow = ({
  title,
  onChangeTitle,
  password,
  onChangePassword,
  onSubmit,
  onCancel,
  isSubmitting,
  inputRef,
}: NewRoomRowProps) => {
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const canCreate = !isSubmitting && isRoomTitleValid(title) && isRoomPasswordValid(password)

  return (
    <div className={styles.root} role="group" aria-label={labels.newRoomGroupAriaLabel}>
      <TitleLine
        title={title}
        onChangeTitle={onChangeTitle}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        inputRef={inputRef}
        onNext={() => passwordInputRef.current?.focus()}
      />
      <PasswordLine
        password={password}
        onChangePassword={onChangePassword}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        canCreate={canCreate}
        inputRef={passwordInputRef}
      />
    </div>
  )
}
