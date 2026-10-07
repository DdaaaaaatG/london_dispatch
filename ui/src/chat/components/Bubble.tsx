/**
 * Bubble — 설계 chat/design/components.md §2.2 (v1.6 · CR-001) · F-CH-15 · 요구 R-CHAT-002 🔒 · R-CHAT-007 · R-LLM-002 · R-CHAT-013
 * 변형 4종(CR-001): 세바스찬 왼쪽 · 시엘 오른쪽(화면만 거울, DOM 순서는 같다) · 유저 가운데 말풍선 · OOC 가운데 한 줄.
 * 루트 클래스(확정): 세바스찬 character sebastian · 시엘 character ciel · 유저 user · OOC ooc(speaker 가 캐릭터여도 캐릭터 키 없음).
 * 본문은 일반 텍스트(React 이스케이프)다. dangerouslySetInnerHTML·마크다운 해석 금지.
 * S3d: 유저 작성자 줄은 authorName 그대로, 비었을 때만 USER_DISPLAY_NAME(userAuthorLabel, R-CHAT-002 🔒 · R-AUTH-004 🔒).
 * S3: isRegenerating(재작성 요청 중인 캐릭터 대사)이면 루트 regenerating · 본문 aria-busy · 머리 줄 "다시 쓰는 중…" role=status(기존 텍스트는 그대로).
 * S3e: 서버 메시지 표시 전용이다. 롱프레스·우클릭·Shift+F10 메뉴와 tabIndex·aria 는 없다(읽기·쓰기 모두). 작업 버튼은 형제 BubbleActions 가 맡는다(D-28).
 */
import { memo } from 'react'
import { CHARACTERS } from '@shared/characters'
import type { CharacterId, Message } from '@shared/types'
import { cx } from '@/components/utils/cx'
import { formatTime, toIsoDateTime } from '@/components/utils/formatDate'
import { labels, userAuthorLabel } from '@/chat/labels'
import styles from './Bubble.module.css'

export type BubbleProps = {
  message: Message
  /** S3: 재작성 요청 중인 대상(캐릭터 변형에서만 의미가 있다) */
  isRegenerating?: boolean
}
export type BubbleVariant = 'sebastian' | 'ciel' | 'user' | 'ooc'

/** 변형 판정. OOC 가 먼저다(speaker 가 캐릭터여도 kind=ooc 면 OOC) */
export const bubbleVariantOf = (m: Message): BubbleVariant => {
  if (m.kind === 'ooc') return 'ooc'
  return m.speaker === 'user' ? 'user' : m.speaker
}

type VariantProps = { message: Message }

const SentTime = ({ createdAt }: { createdAt: number }) => (
  <time className={styles.time} dateTime={toIsoDateTime(createdAt)}>
    {formatTime(createdAt)}
  </time>
)

const CharacterBubble = ({
  message,
  speaker,
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
      )}
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

const UserBubble = ({ message }: VariantProps) => (
  <div className={cx(styles.root, styles.user)}>
    <div className={styles.head}>
      <span className={styles.author}>{userAuthorLabel(message.authorName)}</span>
      <SentTime createdAt={message.createdAt} />
    </div>
    <p className={styles.body}>{message.text}</p>
  </div>
)

const OocBubble = ({ message }: VariantProps) => (
  <div className={cx(styles.root, styles.ooc)}>
    <p className={styles.oocText}>
      <span aria-hidden="true">{labels.oocDecor}</span>
      {` ${labels.oocPrefix} ${message.text} `}
      <span aria-hidden="true">{labels.oocDecor}</span>
    </p>
    <SentTime createdAt={message.createdAt} />
  </div>
)

const BubbleView = ({ message, isRegenerating = false }: BubbleProps) => {
  const variant = bubbleVariantOf(message)
  if (variant === 'ooc') return <OocBubble message={message} />
  if (variant === 'user') return <UserBubble message={message} />
  return <CharacterBubble message={message} speaker={variant} isRegenerating={isRegenerating} />
}

/** 말풍선 한 개. 같은 message·isRegenerating 이면 다시 그리지 않는다(목록 격리, tsx-rules §5) */
export const Bubble = memo(BubbleView)
