/**
 * PendingBubble(B 끝 임시·실패 말풍선) — 설계 chat/design/components.md §2.12 · generate.md §1 · D-11 · design/auto.md §2.1
 * 요구: R-CHAT-005 🔒 · R-CHAT-014 🔒 · R-CHAT-002 🔒 · R-CHAT-011
 * Bubble 변형이 아니라 별도 컴포넌트다(서버 Message 가 아니라 id·시각·메뉴가 없다). 모양은 Bubble.module.css 를 그대로 import 해
 * 같은 DOM 구조·클래스를 쓴다(composes 아님 — 자손 선택자가 그대로 걸리게).
 * 캐릭터 변형: 눌린 캐릭터 쪽(세바스찬 왼쪽·시엘 오른쪽). S3d 중립('auto') 변형: 화자 미정 — 가운데, 이름·아바타·시각 없음, 테두리만.
 * generating: role=status "…"(aria-hidden) + 숨은 안내. failed: role=alert 문구 + 「재시도」(모든 실패 코드에 렌더).
 * 롱프레스·우클릭·Shift+F10 핸들러·tabIndex 없음 — 메뉴 대상은 서버에 저장된 메시지뿐이다.
 */
import { CHARACTERS } from '@shared/characters'
import type { CharacterId, SpeakTarget } from '@shared/types'
import type { ApiError } from '@/api'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/utils/cx'
import { labels, speakErrorText } from '@/chat/labels'
import type { PendingSpeak } from '@/state/chat'
import bubbleStyles from './Bubble.module.css'
import styles from './PendingBubble.module.css'

export type PendingBubbleProps = {
  pending: PendingSpeak
  /** !canSpeak(state) */
  isRetryDisabled: boolean
  /** 캐릭터 실패면 그 캐릭터, 중립 실패면 'auto' (F-CH-32) */
  onRetry: (target: SpeakTarget) => void
}

type BodyProps = {
  status: PendingSpeak['status']
  error: ApiError | null
  /** 생성 중 role=status 숨은 안내 */
  statusText: string
  retryAriaLabel: string
  isRetryDisabled: boolean
  onRetry: () => void
}

/** 본문 상자(캐릭터·중립 공통): 생성 중이면 "…" + 숨은 안내, 실패면 role=alert 문구 + 「재시도」 */
const PendingBody = (props: BodyProps) => {
  const { status, error, statusText, retryAriaLabel, isRetryDisabled, onRetry } = props
  return (
    <div className={cx(bubbleStyles.body, styles.bodyBox)}>
      {status === 'failed' ? (
        <>
          <p className={styles.errorText} role="alert">
            <span className={styles.errorMark} aria-hidden="true">
              !
            </span>{' '}
            {error === null ? '' : speakErrorText(error)}
          </p>
          <div className={styles.retryRow}>
            <Button
              variant="secondary"
              size="sm"
              ariaLabel={retryAriaLabel}
              isDisabled={isRetryDisabled}
              onClick={onRetry}
            >
              {labels.speakRetry}
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className={styles.dots} aria-hidden="true">
            {labels.pendingDots}
          </span>
          <span className={styles.srOnly}>{statusText}</span>
        </>
      )}
    </div>
  )
}

/** S3d 중립: 화자가 정해지기 전. Bubble 모듈의 화자·유저 클래스를 붙이지 않는다(붙으면 화자가 정해진 것처럼 보인다) */
const NeutralPending = ({ pending, isRetryDisabled, onRetry }: PendingBubbleProps) => {
  const isFailed = pending.status === 'failed'
  return (
    <div
      className={cx(styles.pending, styles.neutral, isFailed && styles.failed)}
      role={isFailed ? undefined : 'status'}
      aria-live={isFailed ? undefined : 'polite'}
    >
      <PendingBody
        status={pending.status}
        error={pending.error}
        statusText={labels.autoPendingStatus}
        retryAriaLabel={labels.autoRetryAriaLabel}
        isRetryDisabled={isRetryDisabled}
        onRetry={() => onRetry('auto')}
      />
    </div>
  )
}

type CharacterPendingProps = PendingBubbleProps & { character: CharacterId }

const CharacterPending = ({
  pending,
  character,
  isRetryDisabled,
  onRetry,
}: CharacterPendingProps) => {
  const meta = CHARACTERS[character]
  const isFailed = pending.status === 'failed'
  return (
    <div
      className={cx(
        bubbleStyles.root,
        bubbleStyles.character,
        bubbleStyles[character],
        styles.pending,
        isFailed && styles.failed,
      )}
      role={isFailed ? undefined : 'status'}
      aria-live={isFailed ? undefined : 'polite'}
    >
      <img className={bubbleStyles.avatar} src={meta.avatar} alt="" width={28} height={28} />
      <div className={bubbleStyles.content}>
        <div className={bubbleStyles.head}>
          <span className={bubbleStyles.name}>{meta.shortName}</span>
        </div>
        <PendingBody
          status={pending.status}
          error={pending.error}
          statusText={labels.pendingStatus(meta.shortName)}
          retryAriaLabel={labels.speakRetryAriaLabel(meta.shortName)}
          isRetryDisabled={isRetryDisabled}
          onRetry={() => onRetry(character)}
        />
      </div>
    </div>
  )
}

export const PendingBubble = (props: PendingBubbleProps) => {
  const { character } = props.pending
  return character === 'auto' ? (
    <NeutralPending {...props} />
  ) : (
    <CharacterPending {...props} character={character} />
  )
}
