/**
 * 공용 SheetItem — 설계 rooms/design/components.md §1.15 · 요구 R-CHAT-001 · R-CHAT-007
 * BottomSheet 안의 한 줄 항목(높이 44). danger 톤이면 클래스 키 danger 가 붙는다(테스트는 toHaveClass('danger')).
 * isDisabled 는 쓰기 대기 중인 말풍선 메뉴의 수정·삭제를 막는 데 쓴다.
 */
import { cx } from '@/components/utils/cx'
import styles from './SheetItem.module.css'

export type SheetItemProps = {
  label: string
  onSelect: () => void
  /** 기본 'default' */
  tone?: 'default' | 'danger'
  isDisabled?: boolean
}

export const SheetItem = ({
  label,
  onSelect,
  tone = 'default',
  isDisabled = false,
}: SheetItemProps) => (
  <button
    type="button"
    className={cx(styles.item, tone === 'danger' && styles.danger)}
    disabled={isDisabled}
    onClick={() => onSelect()}
  >
    {label}
  </button>
)
