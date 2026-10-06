/**
 * InlineEditor(인라인 수정) — 설계 chat/design/components.md §2.7 · 구성안 §2 "말풍선 자리 textarea + 취소/저장" · 요구 R-CHAT-007 · R-MSG-004
 * 말풍선 자리에서 원문을 고친다. 정렬은 원래 말풍선 변형과 같다(세바스찬 왼쪽 · 시엘 오른쪽 · 유저·OOC 가운데, CR-001).
 * 저장 조건: 저장 중이 아니고, 생성(speak) 중이 아니고(S3d isSaveLocked — 저장 버튼만 잠근다), 1~2000자이고, 원문과 달라야 한다.
 * Esc 는 취소다(저장 요청 중에는 무시). Enter 는 줄바꿈이다.
 * 마운트 시 입력에 포커스하고 커서를 끝에 둔다. 토큰이 없으면(전환 포함) 호출 쪽이 이 컴포넌트를 렌더하지 않는다.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Message } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/TextArea'
import { cx } from '@/components/utils/cx'
import { labels } from '@/chat/labels'
import { MESSAGE_TEXT_MAX_CHARS, isMessageTextValid } from '@/state/limits'
import { bubbleVariantOf } from './Bubble'
import styles from './InlineEditor.module.css'

export type InlineEditorProps = {
  message: Message
  isSaving: boolean
  /** S3d: 생성(speak) 중이면 true — 저장 버튼만 disabled + 숨은 안내. 취소·입력은 활성(isSaving 과 다르다) */
  isSaveLocked: boolean
  onSave: (text: string) => void
  onCancel: () => void
}

/**
 * 잠긴 동안만 저장 버튼에 aria-describedby 를 건다. 공용 Button 에 해당 prop 이 없어 buttonRef 로 건다.
 * TODO(component): Button 에 ariaDescribedBy 가 생기면 이 훅을 지우고 prop 으로 넘긴다
 */
const useDescribedBy = (ref: RefObject<HTMLButtonElement | null>, id: string | null): void => {
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null || id === null) return
    el.setAttribute('aria-describedby', id)
    return () => el.removeAttribute('aria-describedby')
  }, [ref, id])
}

type EditorActionsProps = Pick<InlineEditorProps, 'isSaving' | 'isSaveLocked' | 'onCancel'> & {
  canSave: boolean
  onSave: () => void
}

/** 버튼 줄(오른쪽 정렬): 취소는 저장 요청 중에만 잠기고, 저장은 canSave 일 때만 열린다. 생성 중 잠금은 숨은 안내로 알린다(S3d) */
const EditorActions = (props: EditorActionsProps) => {
  const { isSaving, isSaveLocked, canSave, onSave, onCancel } = props
  const saveRef = useRef<HTMLButtonElement>(null)
  const noteId = useId()
  useDescribedBy(saveRef, isSaveLocked ? noteId : null)
  return (
    <div className={styles.actions}>
      <Button size="sm" variant="secondary" isDisabled={isSaving} onClick={onCancel}>
        {labels.cancel}
      </Button>
      <Button
        size="sm"
        variant="primary"
        isDisabled={!canSave}
        buttonRef={saveRef}
        onClick={onSave}
      >
        {labels.save}
      </Button>
      {isSaveLocked && (
        <span id={noteId} className={styles.srOnly}>
          {labels.editSaveLockedNote}
        </span>
      )}
    </div>
  )
}

export const InlineEditor = ({
  message,
  isSaving,
  isSaveLocked,
  onSave,
  onCancel,
}: InlineEditorProps) => {
  const [text, setText] = useState(message.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSave = !isSaving && !isSaveLocked && isMessageTextValid(text) && text !== message.text

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (el === null) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const handleEscape = (): void => {
    if (!isSaving) onCancel()
  }

  return (
    <div
      className={cx(styles.editor, styles[bubbleVariantOf(message)])}
      role="group"
      aria-label={labels.editAriaLabel}
    >
      <TextArea
        value={text}
        onChange={setText}
        ariaLabel={labels.editInputAriaLabel}
        maxRows={6}
        maxChars={MESSAGE_TEXT_MAX_CHARS}
        counterMode="overflow"
        onEscape={handleEscape}
        isReadOnly={isSaving}
        textareaRef={textareaRef}
      />
      <EditorActions
        isSaving={isSaving}
        isSaveLocked={isSaveLocked}
        canSave={canSave}
        onSave={() => onSave(text)}
        onCancel={onCancel}
      />
    </div>
  )
}
