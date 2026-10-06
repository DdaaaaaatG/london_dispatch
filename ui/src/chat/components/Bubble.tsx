/**
 * Bubble — 설계 chat/design/components.md §2.2 (v1.6 · CR-001) · F-CH-15 · 요구 R-CHAT-002 🔒 · R-CHAT-007 · R-LLM-002 · R-CHAT-013
 * 변형 4종(CR-001): 세바스찬 왼쪽 · 시엘 오른쪽(화면만 거울, DOM 순서는 같다) · 유저 가운데 말풍선 · OOC 가운데 한 줄.
 * 루트 클래스(확정): 세바스찬 character sebastian · 시엘 character ciel · 유저 user · OOC ooc(speaker 가 캐릭터여도 캐릭터 키 없음).
 * 본문은 일반 텍스트(React 이스케이프)다. dangerouslySetInnerHTML·마크다운 해석 금지.
 * S3: isRegenerating(재작성 요청 중인 캐릭터 대사)이면 루트 regenerating · 본문 aria-busy · 머리 줄 "다시 쓰는 중…" role=status(기존 텍스트는 그대로).
 * S2: onOpenMenu 가 있을 때(쓰기 가능)만 롱프레스·우클릭·Shift+F10 핸들러와 tabIndex·aria 를 붙인다. 없으면(읽기 전용) 아무것도 붙이지 않는다.
 */
import { memo } from 'react'
import type { HTMLAttributes, KeyboardEvent } from 'react'
import { CHARACTERS } from '@shared/characters'
import type { CharacterId, Message } from '@shared/types'
import { useLongPress } from '@/components/hooks/useLongPress'
import { cx } from '@/components/utils/cx'
import { formatTime, toIsoDateTime } from '@/components/utils/formatDate'
import { labels } from '@/chat/labels'
import styles from './Bubble.module.css'

export type BubbleProps = {
  message: Message
  /** 쓰기 가능일 때만. 없으면 메뉴 핸들러·tabIndex 를 붙이지 않는다 */
  onOpenMenu?: ((message: Message) => void) | undefined
  /** S3: 재작성 요청 중인 대상(캐릭터 변형에서만 의미가 있다) */
  isRegenerating?: boolean
}
export type BubbleVariant = 'sebastian' | 'ciel' | 'user' | 'ooc'

/** 변형 판정. OOC 가 먼저다(speaker 가 캐릭터여도 kind=ooc 면 OOC) */
export const bubbleVariantOf = (m: Message): BubbleVariant => {
  if (m.kind === 'ooc') return 'ooc'
  return m.speaker === 'user' ? 'user' : m.speaker
}

/** 변형 컴포넌트가 루트에 펼치는 속성(읽기 전용이면 비어 있다) */
type RootAttributes = HTMLAttributes<HTMLDivElement>
type VariantProps = {
  message: Message
  rootProps: RootAttributes
  menuClass: string | false | undefined
}

const SentTime = ({ createdAt }: { createdAt: number }) => (
  <time className={styles.time} dateTime={toIsoDateTime(createdAt)}>
    {formatTime(createdAt)}
  </time>
)

const CharacterBubble = ({
  message,
  speaker,
  rootProps,
  menuClass,
  isRegenerating,
}: VariantProps & { speaker: CharacterId; isRegenerating: boolean }) => {
  const meta = CHARACTERS[speaker]
  return (
    <div
      className={cx(
        styles.root,
        styles.character,
        styles[speaker],
        isRegenerating && styles.regenerating,
        menuClass,
      )}
      {...rootProps}
    >
      <img className={styles.avatar} src={meta.avatar} alt="" width={28} height={28} />
      <div className={styles.content}>
        <div className={styles.head}>
          <span className={styles.name}>{meta.shortName}</span>
          <SentTime createdAt={message.createdAt} />
          {isRegenerating && (
            <span className={styles.regeneratingNote} role="status">
              {labels.regeneratingNote}
            </span>
          )}
        </div>
        <p className={styles.body} aria-busy={isRegenerating ? true : undefined}>
          {message.text}
        </p>
      </div>
    </div>
  )
}

const UserBubble = ({ message, rootProps, menuClass }: VariantProps) => (
  <div className={cx(styles.root, styles.user, menuClass)} {...rootProps}>
    <div className={styles.head}>
      <span className={styles.author}>{message.authorName ?? labels.unknownAuthor}</span>
      <SentTime createdAt={message.createdAt} />
    </div>
    <p className={styles.body}>{message.text}</p>
  </div>
)

const OocBubble = ({ message, rootProps, menuClass }: VariantProps) => (
  <div className={cx(styles.root, styles.ooc, menuClass)} {...rootProps}>
    <p className={styles.oocText}>
      <span aria-hidden="true">{labels.oocDecor}</span>
      {` ${labels.oocPrefix} ${message.text} `}
      <span aria-hidden="true">{labels.oocDecor}</span>
    </p>
    <SentTime createdAt={message.createdAt} />
  </div>
)

/** Shift+F10 또는 메뉴 키(ContextMenu)면 말풍선 메뉴를 연다. 브라우저 기본 메뉴는 막는다 */
const isMenuKey = (event: KeyboardEvent<HTMLElement>): boolean =>
  (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu'

/** 메뉴 핸들러·접근성 속성. useLongPress 는 Hook 규칙 때문에 항상 부르고, 읽기 전용이면 빈 속성을 돌려준다 */
const useMenuAttributes = (
  message: Message,
  onOpenMenu: BubbleProps['onOpenMenu'],
): RootAttributes => {
  const longPress = useLongPress({ onLongPress: () => onOpenMenu?.(message) })
  if (onOpenMenu === undefined) return {}
  return {
    ...longPress,
    tabIndex: 0,
    'aria-haspopup': 'dialog',
    'aria-keyshortcuts': 'Shift+F10',
    onKeyDown: event => {
      if (!isMenuKey(event)) return
      event.preventDefault()
      onOpenMenu(message)
    },
  }
}

const BubbleView = ({ message, onOpenMenu, isRegenerating = false }: BubbleProps) => {
  const rootProps = useMenuAttributes(message, onOpenMenu)
  const menuClass = onOpenMenu !== undefined && styles.menuEnabled
  const variant = bubbleVariantOf(message)
  if (variant === 'ooc') return <OocBubble {...{ message, rootProps, menuClass }} />
  if (variant === 'user') return <UserBubble {...{ message, rootProps, menuClass }} />
  return (
    <CharacterBubble {...{ message, rootProps, menuClass, isRegenerating }} speaker={variant} />
  )
}

/** 말풍선 한 개. 같은 message·onOpenMenu 면 다시 그리지 않는다(목록 격리, tsx-rules §5) */
export const Bubble = memo(BubbleView)
