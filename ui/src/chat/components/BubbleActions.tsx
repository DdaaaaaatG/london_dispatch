/**
 * BubbleActions(말풍선 액션 버튼 줄) — 설계 chat/design/actions.md §1 · §4 · §5 F-CH-45 · 50 · 51 · §7 · 요구 R-CHAT-007 🔒 · R-CHAT-002 🔒 · R-CHAT-013 🔒
 * 말풍선 바로 아래에 「수정」·(「재작성」)·「삭제」를 늘 보여 준다(S3e — 롱프레스·우클릭 메뉴를 대체한다).
 * 쓰기 가능할 때만 호출 쪽이 렌더한다(토큰이 없으면 DOM 에 없다). 이 부품은 api 래퍼를 모르고, 클릭하면 핸들러에 message 만 넘긴다.
 * 「재작성」은 canRegenerate 일 때만 DOM 에 있다(비활성이 아니다). 잠금(isDisabled)은 네이티브 disabled 만 쓴다.
 * 포커스: 편집기가 닫히면 같은 말풍선의 「수정」으로(useEditFocus), 재작성 잠금이 풀리면 같은 「재작성」으로(useRefocusAfterUnlock, 포커스를 잃었을 때만).
 * 버튼 형태는 공용 Button(sm · ghost)이 주고, 글자색은 지역 CSS 가 덧칠한다(D-25).
 */
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { CHARACTERS } from '@shared/characters'
import type { Message } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/utils/cx'
import { labels, userAuthorLabel } from '@/chat/labels'
import { bubbleVariantOf } from './Bubble'
import styles from './BubbleActions.module.css'

export type BubbleActionHandlers = {
  /** F-CH-46 startEdit */
  onEdit: (message: Message) => void
  /** F-CH-48 regenerateFromActions */
  onRegenerate: (message: Message) => void
  /** F-CH-47 askDeleteMessage */
  onDelete: (message: Message) => void
}

export type BubbleActionsProps = BubbleActionHandlers & {
  message: Message
  /** message.id === regenerateTargetId (F-CH-52) */
  canRegenerate: boolean
  /** isActionLocked — 쓰기 대기·생성 중·다른 편집 중·방 이름 변경·삭제 중 */
  isDisabled: boolean
  /** message.id === editFocusId — 편집기가 닫혀 「수정」으로 포커스를 돌려 달라는 요청(F-CH-50) */
  shouldFocusEdit: boolean
  /** 요청을 소비했다. isFocused=false 면 「수정」이 포커스를 못 받은 것(잠김)이라 호출 쪽이 히스토리로 대신한다 */
  onEditFocusDone: (isFocused: boolean) => void
}

/** 버튼 이름에 쓰는 말풍선 주인. 캐릭터 = 짧은 이름 · 유저 = authorName(비었으면 어떠한 의지) · OOC = [지시] */
const nameOf = (message: Message): string => {
  const variant = bubbleVariantOf(message)
  if (variant === 'ooc') return labels.oocPrefix
  if (variant === 'user') return userAuthorLabel(message.authorName)
  return CHARACTERS[variant].shortName
}

/**
 * F-CH-50: shouldFocusEdit 가 켜지면 「수정」으로 포커스하고 결과를 알린다.
 * disabled 라 포커스를 못 받으면(예: 자동 응답 생성 중 편집 취소) false 로 알려 호출 쪽이 히스토리 log 로 대신한다
 */
const useEditFocus = (
  editRef: RefObject<HTMLButtonElement | null>,
  shouldFocusEdit: boolean,
  onEditFocusDone: (isFocused: boolean) => void,
): void => {
  useLayoutEffect(() => {
    if (!shouldFocusEdit) return
    const edit = editRef.current
    edit?.focus()
    onEditFocusDone(edit !== null && document.activeElement === edit)
  }, [shouldFocusEdit, editRef, onEditFocusDone])
}

/**
 * F-CH-51: 「재작성」을 누르면 요청 동안 버튼이 disabled 가 되어 포커스를 잃는다. 잠금이 풀리면 같은 「재작성」으로 돌린다.
 * 사용자가 그사이 다른 곳으로 옮겼으면(activeElement 가 body 가 아님) 건드리지 않는다. 누른 표시는 한 번 쓰고 비운다
 */
const useRefocusAfterUnlock = (
  isDisabled: boolean,
  regenerateRef: RefObject<HTMLButtonElement | null>,
  pressedRef: RefObject<boolean>,
): void => {
  useEffect(() => {
    if (isDisabled || !pressedRef.current) return
    pressedRef.current = false
    const active = document.activeElement
    if (active !== null && active !== document.body) return
    regenerateRef.current?.focus()
  }, [isDisabled, regenerateRef, pressedRef])
}

type ActionButtonProps = {
  /** 보이는 글자 */
  label: string
  ariaLabel: string
  isDisabled: boolean
  buttonRef?: RefObject<HTMLButtonElement | null>
  onClick: () => void
}

/** 버튼 줄의 버튼 한 개: 공용 Button sm · ghost. 글자색은 BubbleActions.module.css 가 덧칠한다(D-25) */
const ActionButton = ({ label, ariaLabel, isDisabled, buttonRef, onClick }: ActionButtonProps) => (
  <Button
    size="sm"
    variant="ghost"
    ariaLabel={ariaLabel}
    isDisabled={isDisabled}
    buttonRef={buttonRef}
    onClick={onClick}
  >
    {label}
  </Button>
)

const BubbleActionsView = (props: BubbleActionsProps) => {
  const { message, canRegenerate, isDisabled, shouldFocusEdit, onEditFocusDone } = props
  const { onEdit, onRegenerate, onDelete } = props
  const name = nameOf(message)
  const editRef = useRef<HTMLButtonElement>(null)
  const regenerateRef = useRef<HTMLButtonElement>(null)
  const regeneratePressedRef = useRef(false)
  useEditFocus(editRef, shouldFocusEdit, onEditFocusDone)
  useRefocusAfterUnlock(isDisabled, regenerateRef, regeneratePressedRef)

  const pressRegenerate = (): void => {
    regeneratePressedRef.current = true
    onRegenerate(message)
  }

  return (
    <div
      role="group"
      aria-label={labels.bubbleActionsAriaLabel(name)}
      className={cx(styles.actions, styles[bubbleVariantOf(message)])}
    >
      <ActionButton
        label={labels.edit}
        ariaLabel={labels.editActionAriaLabel(name)}
        isDisabled={isDisabled}
        buttonRef={editRef}
        onClick={() => onEdit(message)}
      />
      {canRegenerate && (
        <ActionButton
          label={labels.regenerate}
          ariaLabel={labels.regenerateActionAriaLabel(name)}
          isDisabled={isDisabled}
          buttonRef={regenerateRef}
          onClick={pressRegenerate}
        />
      )}
      <span className={styles.danger}>
        <ActionButton
          label={labels.delete}
          ariaLabel={labels.deleteActionAriaLabel(name)}
          isDisabled={isDisabled}
          onClick={() => onDelete(message)}
        />
      </span>
    </div>
  )
}

/** 버튼 줄 한 개. 같은 props 면 다시 그리지 않는다(핸들러는 useChatSheets 가 참조를 안정시켜 넘긴다) */
export const BubbleActions = memo(BubbleActionsView)
