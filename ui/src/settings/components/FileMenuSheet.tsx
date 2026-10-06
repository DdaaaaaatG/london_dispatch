/**
 * FileMenuSheet(①) — 설계 settings/design/components.md §3.7 · 구성안 §5-1 · 요구 R-SET-007 · R-SET-008
 * ⋯ 로 여는 설정 파일 메뉴: 내보내기 · 가져오기 · 취소. stale(인증 만료)이면 「가져오기」만 비활성이다(내보내기는 보관용으로 허용).
 */
import { BottomSheet, SheetItem } from '@/components/ui/BottomSheet'
import { labels } from '../labels'
import styles from './Sheets.module.css'

export type FileMenuSheetProps = {
  /** isStale */
  isImportDisabled: boolean
  onExport: () => void
  onImport: () => void
  onClose: () => void
}

export const FileMenuSheet = ({
  isImportDisabled,
  onExport,
  onImport,
  onClose,
}: FileMenuSheetProps) => (
  <BottomSheet
    ariaLabel={labels.fileMenuTitle}
    header={<h2 className={styles.title}>{labels.fileMenuTitle}</h2>}
    onClose={onClose}
  >
    <SheetItem label={labels.exportItem} onSelect={onExport} />
    <SheetItem label={labels.importItem} onSelect={onImport} isDisabled={isImportDisabled} />
    <SheetItem label={labels.cancel} onSelect={onClose} />
  </BottomSheet>
)
