/**
 * Composer(C 하단 바) — 설계 chat/design/components.md §2.6 · 구성안 §2 C · 요구 R-CHAT-004 · R-CHAT-006 · R-AUTH-004
 * OOC 토글 · 입력창(1~3줄, 2000자) · 전송. 입력창은 유저 발화/OOC 지시를 저장할 뿐 AI 를 부르지 않는다(onSend → appendUser 한 곳).
 * 전송: canSend 이고 저장 중이 아니고 1~2000자일 때만. 저장되면 입력을 비우고(OOC 토글 값은 유지) 입력에 포커스한다. 실패면 입력을 그대로 둔다.
 * 전송 중에는 입력이 readOnly 이고 하단 바가 aria-busy 다. 다른 쓰기(수정 저장·삭제) 중에는 canSend 가 false 라 전송만 잠기고 타이핑은 된다.
 * 캐릭터 버튼(S3)은 아직 렌더하지 않는다(1행 왼쪽 자리는 비워 둔다). 토큰이 없으면 호출 쪽이 이 컴포넌트를 렌더하지 않는다.
 */
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/TextArea'
import { Toggle } from '@/components/ui/Toggle'
import { labels } from '@/chat/labels'
import { MESSAGE_TEXT_MAX_CHARS, isMessageTextValid } from '@/state/limits'
import styles from './Composer.module.css'

export type ComposerProps = {
  /** state.phase === 'ready' && state.writing === null */
  canSend: boolean
  /** state.writing?.kind === 'send' */
  isSending: boolean
  /** true = 저장됨(입력을 비운다) */
  onSend: (text: string, ooc: boolean) => Promise<boolean>
}

export const Composer = ({ canSend, isSending, onSend }: ComposerProps) => {
  const [text, setText] = useState('')
  const [ooc, setOoc] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSendable = canSend && !isSending && isMessageTextValid(text)

  const submit = async (): Promise<void> => {
    if (!isSendable) return
    const isSaved = await onSend(text, ooc)
    if (!isSaved) return
    setText('')
    textareaRef.current?.focus()
  }

  return (
    <div
      className={styles.root}
      role="group"
      aria-label={labels.composerAriaLabel}
      aria-busy={isSending}
    >
      <div className={styles.toggleRow}>
        <Toggle
          isOn={ooc}
          onChange={setOoc}
          onLabel={labels.oocOn}
          offLabel={labels.oocOff}
          ariaLabel={labels.oocAriaLabel}
        />
      </div>
      <div className={styles.inputRow}>
        <TextArea
          value={text}
          onChange={setText}
          ariaLabel={labels.inputAriaLabel}
          placeholder={labels.inputPlaceholder}
          maxRows={3}
          maxChars={MESSAGE_TEXT_MAX_CHARS}
          counterMode="overflow"
          onEnter={() => void submit()}
          isReadOnly={isSending}
          textareaRef={textareaRef}
        />
        <Button variant="primary" isDisabled={!isSendable} onClick={() => void submit()}>
          {labels.send}
        </Button>
      </div>
    </div>
  )
}
