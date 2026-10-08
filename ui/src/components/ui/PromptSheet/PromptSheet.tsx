/**
 * 공용 PromptSheet — 설계 rooms/design/components.md §1.17 · 요구 R-CHAT-001 · R-LOCK-004
 * 한 줄 입력을 받는 시트(사용처: chat 방 이름 변경 · S6 입장 시트 · chat 비밀번호 걸기/바꾸기). BottomSheet 안에 제목(h2) · TextInput(n/max 카운터) · 실패 문구 · 버튼 줄.
 * 입력값은 시트 로컬 상태라 errorText 가 바뀌어도(시트가 그대로 열려 있는 동안) 유지된다.
 * 저장 조건은 호출 쪽 canSave 가 정한다(예: 유효 && 바뀜). 요청 중(isBusy)이면 입력 readOnly, 두 버튼 disabled, Esc·덮개 닫힘 막음.
 * (S6) inputType='password' 는 내부 TextInput 의 type 으로, placeholder 는 그대로 전달한다(lock.md D-L1). 둘 다 생략하면 이전과 같다.
 * 문구는 props 로만 받는다(§1.9).
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import styles from './PromptSheet.module.css'

export type PromptSheetProps = {
  /** 시트 제목(h2). 시트 aria-label 도 같은 값 */
  title: string
  inputAriaLabel: string
  initialValue: string
  maxChars: number
  /** 호출 쪽 검증(예: 유효 && 바뀜) */
  canSave: (value: string) => boolean
  saveLabel: string
  cancelLabel: string
  onSave: (value: string) => void
  onCancel: () => void
  /** 요청 중 */
  isBusy?: boolean
  /** 있으면 입력 아래 role=alert 한 줄(danger) */
  errorText?: string | null
  /** (S6) 기본 'text'. 내부 TextInput 의 type 으로 그대로 전달 */
  inputType?: 'text' | 'password' | undefined
  /** (S6) 내부 TextInput 의 placeholder 로 그대로 전달. 문구는 호출 쪽 labels */
  placeholder?: string | undefined
}

type PromptActionsProps = Pick<PromptSheetProps, 'saveLabel' | 'cancelLabel' | 'onCancel'> & {
  isBusy: boolean
  isSavable: boolean
  onSubmit: () => void
}

/** 버튼 줄: 취소(왼쪽) · 저장(오른쪽). 요청 중이면 둘 다 비활성 */
const PromptActions = ({
  saveLabel,
  cancelLabel,
  onCancel,
  isBusy,
  isSavable,
  onSubmit,
}: PromptActionsProps) => (
  <div className={styles.actions}>
    <Button size="lg" variant="secondary" isDisabled={isBusy} onClick={onCancel}>
      {cancelLabel}
    </Button>
    <Button size="lg" variant="primary" isDisabled={!isSavable} onClick={onSubmit}>
      {saveLabel}
    </Button>
  </div>
)

type PromptFieldProps = Pick<
  PromptSheetProps,
  'inputAriaLabel' | 'maxChars' | 'inputType' | 'placeholder'
> & {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  isBusy: boolean
  onSubmit: () => void
}

/** 입력 한 줄. 요청 중이면 읽기 전용이고 Enter 는 저장이다. 비밀번호 모드·placeholder 는 호출 쪽이 정한다(S6) */
const PromptField = ({
  inputAriaLabel,
  maxChars,
  inputType = 'text',
  placeholder,
  value,
  onChange,
  inputRef,
  isBusy,
  onSubmit,
}: PromptFieldProps) => (
  <TextInput
    value={value}
    onChange={onChange}
    ariaLabel={inputAriaLabel}
    type={inputType}
    placeholder={placeholder}
    maxChars={maxChars}
    inputRef={inputRef}
    onEnter={onSubmit}
    isReadOnly={isBusy}
  />
)

/** 실패 문구 한 줄(없으면 렌더하지 않는다) */
const PromptError = ({ text }: { text: string | null }) =>
  text === null ? null : (
    <p className={styles.error} role="alert">
      {text}
    </p>
  )

/** 마운트 시 입력에 포커스하고 커서를 끝에 둔다 */
const useFocusAtEnd = (inputRef: RefObject<HTMLInputElement | null>): void => {
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input === null) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [inputRef])
}

export const PromptSheet = ({
  title,
  initialValue,
  canSave,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
  isBusy = false,
  errorText = null,
  ...fieldProps
}: PromptSheetProps) => {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSavable = !isBusy && canSave(value)
  const submit = (): void => {
    if (isSavable) onSave(value)
  }
  useFocusAtEnd(inputRef)

  return (
    <BottomSheet
      ariaLabel={title}
      onClose={onCancel}
      isDismissDisabled={isBusy}
      initialFocusRef={inputRef}
    >
      <h2 className={styles.title}>{title}</h2>
      <PromptField
        {...fieldProps}
        value={value}
        onChange={setValue}
        inputRef={inputRef}
        isBusy={isBusy}
        onSubmit={submit}
      />
      <PromptError text={errorText} />
      <PromptActions
        saveLabel={saveLabel}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        isBusy={isBusy}
        isSavable={isSavable}
        onSubmit={submit}
      />
    </BottomSheet>
  )
}
