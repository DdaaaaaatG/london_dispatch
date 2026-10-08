/**
 * ListRow — 설계 rooms/design/components.md §2.1 · design/lock.md §1.4 · 요구 R-ROOMS-001 · R-ROOMS-005 · R-LOCK-003
 * 버튼 한 개가 행 전체(56px). 안 잠김: 제목(한 줄 말줄임) + time(오른쪽). Enter·Space 는 button 기본 동작.
 * (S6) 잠긴 변형(isLocked): 자물쇠 그림(aria-hidden) + 제목 한 묶음, 날짜 props 자체가 없고 <time> 을 만들지 않는다(숨김 CSS 금지, U8).
 * 롱프레스 메뉴 없음(구성안 §5 미채택). 공용 승격 후보지만 지금은 rooms 로컬이다(design §13).
 */
import styles from './ListRow.module.css'

type ListRowBase = {
  title: string
  /** 안 잠김: labels.rowAriaLabel(title, dateText) · 잠김: labels.lockedRowAriaLabel(title) */
  ariaLabel: string
  onSelect: () => void
}

export type ListRowProps =
  | (ListRowBase & {
      isLocked?: false
      /** MM.DD */
      dateText: string
      /** YYYY-MM-DD */
      dateTime: string
    })
  | (ListRowBase & { isLocked: true })

/** 16px 자물쇠 장식(몸통 + 고리). 이모지 대신 인라인 SVG — 이름은 행 aria-label 이 말한다 */
const LockGlyph = () => (
  <svg
    className={styles.lock}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3" y="7" width="10" height="7" fill="currentColor" stroke="none" />
    <path
      d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
)

export const ListRow = (props: ListRowProps) => {
  const { title, ariaLabel, onSelect } = props
  return (
    <button type="button" className={styles.root} aria-label={ariaLabel} onClick={() => onSelect()}>
      {props.isLocked === true ? (
        <span className={styles.titleGroup}>
          <LockGlyph />
          <span className={styles.title}>{title}</span>
        </span>
      ) : (
        <>
          <span className={styles.title}>{title}</span>
          <time className={styles.date} dateTime={props.dateTime}>
            {props.dateText}
          </time>
        </>
      )}
    </button>
  )
}
