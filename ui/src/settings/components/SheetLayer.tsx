/**
 * SheetLayer — 설계 settings/design/components.md §1 트리(시트: 하나만, sheet 상태) · 요구 R-SET-007 · R-SET-008 · R-SET-009
 * 열린 시트 하나를 렌더한다: ① 설정 파일 메뉴 · ② 내보내기 · ③ 가져오기 · ④ 이탈 확인(공용 ConfirmDialog, window.confirm 금지).
 * 내보내기 대상은 평소 기준값, stale 이면 정규화 초안이다(S-13). 시트가 없으면(none) 아무것도 렌더하지 않는다.
 */
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { exportTargetOf, isDraftDirty } from '@/state/settings'
import type { ReadyState } from '@/state/settings'
import type { ImportSuccess } from '@/state/settingsFile'
import { labels } from '../labels'
import type { SettingsSheet } from '../useSettingsUi'
import { type ExportNote, ExportSheet } from './ExportSheet'
import { FileMenuSheet } from './FileMenuSheet'
import { ImportSheet } from './ImportSheet'

export type SheetLayerProps = {
  sheet: SettingsSheet
  state: ReadyState
  onClose: () => void
  onExport: () => void
  onImport: () => void
  onImported: (result: ImportSuccess) => void
  onDownloadFailed: () => void
  onConfirmLeave: () => void
}

/** ② 안내: stale 이면 초안을 내보낸다는 말, 저장하지 않은 변경이 있으면 기준값만 나간다는 말 */
const exportNoteOf = (state: ReadyState): ExportNote => {
  if (state.isStale) return 'stale'
  return isDraftDirty(state.draft, state.base.settings) ? 'dirty' : null
}

export const SheetLayer = ({
  sheet,
  state,
  onClose,
  onExport,
  onImport,
  onImported,
  onDownloadFailed,
  onConfirmLeave,
}: SheetLayerProps) => {
  switch (sheet) {
    case 'fileMenu':
      return (
        <FileMenuSheet
          isImportDisabled={state.isStale}
          onExport={onExport}
          onImport={onImport}
          onClose={onClose}
        />
      )
    case 'export':
      return (
        <ExportSheet
          target={exportTargetOf(state)}
          note={exportNoteOf(state)}
          onClose={onClose}
          onDownloadFailed={onDownloadFailed}
        />
      )
    case 'import':
      return <ImportSheet base={state.base.settings} onImported={onImported} onClose={onClose} />
    case 'leave':
      return (
        <ConfirmDialog
          title={labels.leaveTitle}
          message={labels.leaveMessage}
          confirmLabel={labels.leaveConfirm}
          cancelLabel={labels.cancel}
          onConfirm={onConfirmLeave}
          onCancel={onClose}
        />
      )
    default:
      return null
  }
}
