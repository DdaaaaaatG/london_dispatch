/**
 * ListRow — 설계 rooms/design/components.md §2.1 · 요구 R-ROOMS-001 · R-ROOMS-005
 * 버튼 한 개가 행 전체(56px). 제목(한 줄 말줄임) + time(오른쪽). Enter·Space 는 button 기본 동작.
 * 롱프레스 메뉴 없음(구성안 §5 미채택). 공용 승격 후보지만 지금은 rooms 로컬이다(design §13).
 */
import styles from './ListRow.module.css'

export type ListRowProps = {
  title: string
  /** MM.DD */
  dateText: string
  /** YYYY-MM-DD */
  dateTime: string
  /** labels.rowAriaLabel(title, dateText) */
  ariaLabel: string
  onSelect: () => void
}

export const ListRow = ({ title, dateText, dateTime, ariaLabel, onSelect }: ListRowProps) => (
  <button type="button" className={styles.root} aria-label={ariaLabel} onClick={() => onSelect()}>
    <span className={styles.title}>{title}</span>
    <time className={styles.date} dateTime={dateTime}>
      {dateText}
    </time>
  </button>
)
