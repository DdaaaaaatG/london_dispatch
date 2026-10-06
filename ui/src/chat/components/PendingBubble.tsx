/**
 * PendingBubble(B 끝 임시·실패 말풍선) — 설계 chat/design/components.md §2.12 · generate.md §1 · D-11 · 요구 R-CHAT-005 🔒 · R-CHAT-002 🔒 · R-CHAT-011
 * Bubble 변형이 아니라 별도 컴포넌트다(서버 Message 가 아니라 id·시각·메뉴가 없다). 모양은 Bubble.module.css 를 그대로 import 해
 * 같은 DOM 구조·클래스를 쓴다(composes 아님 — 자손 선택자가 그대로 걸리게). 눌린 캐릭터 쪽(세바스찬 왼쪽·시엘 오른쪽)에 놓인다.
 * generating: role=status "…"(aria-hidden) + 숨은 안내. failed: role=alert 문구 + 「재시도」(모든 실패 코드에 렌더).
 * 롱프레스·우클릭·Shift+F10 핸들러·tabIndex 없음 — 메뉴 대상은 서버에 저장된 메시지뿐이다.
 */
import { CHARACTERS } from '@shared/characters'
import type { CharacterId } from '@shared/types'
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
  onRetry: (character: CharacterId) => void
}

export const PendingBubble = ({ pending, isRetryDisabled, onRetry }: PendingBubbleProps) => {
  const { character, status, error } = pending
  const meta = CHARACTERS[character]
  const isFailed = status === 'failed'
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
        <div className={cx(bubbleStyles.body, styles.bodyBox)}>
          {isFailed ? (
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
                  ariaLabel={labels.speakRetryAriaLabel(meta.shortName)}
                  isDisabled={isRetryDisabled}
                  onClick={() => onRetry(character)}
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
              <span className={styles.srOnly}>{labels.pendingStatus(meta.shortName)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
