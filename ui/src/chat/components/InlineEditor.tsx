/**
 * InlineEditor(인라인 수정) — 설계 chat/design/components.md §2.7 · 구성안 §2 "말풍선 자리 textarea + 취소/저장" · 요구 R-CHAT-007 · R-MSG-004
 * 말풍선 자리에서 원문을 고친다. 정렬은 원래 말풍선 변형과 같다(세바스찬 왼쪽 · 시엘 오른쪽 · 유저·OOC 가운데, CR-001).
 * 저장 조건: 저장 중이 아니고, 1~2000자이고, 원문과 달라야 한다. Esc 는 취소다(저장 요청 중에는 무시). Enter 는 줄바꿈이다.
 * 마운트 시 입력에 포커스하고 커서를 끝에 둔다. 토큰이 없으면(전환 포함) 호출 쪽이 이 컴포넌트를 렌더하지 않는다.
 */
import { useLayoutEffect, useRef, useState } from 'react'
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
  onSave: (text: string) => void
  onCancel: () => void
}

export const InlineEditor = ({ message, isSaving, onSave, onCancel }: InlineEditorProps) => {
  const [text, setText] = useState(message.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSave = !isSaving && isMessageTextValid(text) && text !== message.text

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
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" isDisabled={isSaving} onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button size="sm" variant="primary" isDisabled={!canSave} onClick={() => onSave(text)}>
          {labels.save}
        </Button>
      </div>
    </div>
  )
}
