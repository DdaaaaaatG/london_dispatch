/**
 * Bubble — 설계 chat/design/components.md §2.2 · F-CH-15 · 요구 R-CHAT-002 · R-LLM-002 · R-CHAT-013
 * 변형: character(왼쪽) · user(오른쪽) · ooc(중앙). 루트 클래스 character·user·ooc + 캐릭터 색 ciel·sebastian(확정 v1.3).
 * 본문은 일반 텍스트(React 이스케이프)다. dangerouslySetInnerHTML·마크다운 해석 금지.
 * S1 은 onContextMenu·롱프레스 핸들러를 붙이지 않는다(읽기 전용 분기, design §10).
 */
import { memo } from 'react'
import { CHARACTERS } from '@shared/characters'
import type { CharacterId, Message } from '@shared/types'
import { cx } from '@/components/utils/cx'
import { formatTime, toIsoDateTime } from '@/components/utils/formatDate'
import { labels } from '@/chat/labels'
import styles from './Bubble.module.css'

export type BubbleProps = { message: Message }
export type BubbleVariant = 'character' | 'user' | 'ooc'

/** 변형 판정. OOC 가 먼저다(speaker 가 캐릭터여도 kind=ooc 면 OOC) */
export const bubbleVariantOf = (m: Message): BubbleVariant => {
  if (m.kind === 'ooc') return 'ooc'
  return m.speaker === 'user' ? 'user' : 'character'
}

const SentTime = ({ createdAt }: { createdAt: number }) => (
  <time className={styles.time} dateTime={toIsoDateTime(createdAt)}>
    {formatTime(createdAt)}
  </time>
)

const CharacterBubble = ({ message, speaker }: { message: Message; speaker: CharacterId }) => {
  const meta = CHARACTERS[speaker]
  return (
    <div className={cx(styles.root, styles.character, styles[speaker])}>
      <img className={styles.avatar} src={meta.avatar} alt="" width={28} height={28} />
      <div className={styles.content}>
        <div className={styles.head}>
          <span className={styles.name}>{meta.shortName}</span>
          <SentTime createdAt={message.createdAt} />
        </div>
        <p className={styles.body}>{message.text}</p>
      </div>
    </div>
  )
}

const UserBubble = ({ message }: { message: Message }) => (
  <div className={cx(styles.root, styles.user)}>
    <div className={styles.head}>
      <span className={styles.author}>{message.authorName ?? labels.unknownAuthor}</span>
      <SentTime createdAt={message.createdAt} />
    </div>
    <p className={styles.body}>{message.text}</p>
  </div>
)

const OocBubble = ({ message }: { message: Message }) => (
  <div className={cx(styles.root, styles.ooc)}>
    <p className={styles.oocText}>
      <span aria-hidden="true">{labels.oocDecor}</span>
      {` ${labels.oocPrefix} ${message.text} `}
      <span aria-hidden="true">{labels.oocDecor}</span>
    </p>
    <SentTime createdAt={message.createdAt} />
  </div>
)

const BubbleView = ({ message }: BubbleProps) => {
  if (bubbleVariantOf(message) === 'ooc') return <OocBubble message={message} />
  if (message.speaker === 'user') return <UserBubble message={message} />
  return <CharacterBubble message={message} speaker={message.speaker} />
}

/** 말풍선 한 개. 같은 message 객체면 다시 그리지 않는다(목록 격리, tsx-rules §5) */
export const Bubble = memo(BubbleView)
