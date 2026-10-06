/**
 * ExportSheet(②) — 설계 settings/design/components.md §3.8 · functions.md F-ST-13 · F-ST-14 · 요구 R-SET-007 · R-NFR-004
 * 내보낼 설정 JSON 을 읽기 전용 글로 보여 주고 「파일로 저장」(Blob 다운로드)·「닫기」를 둔다. 복사해 쓸 수도 있다(다운로드가 막힌 iframe 대비).
 * 대상 = 호출 쪽이 정한다(평소 기준값, stale 이면 정규화 초안). 마운트 시 한 번 만들어 열려 있는 동안 바뀌지 않는다(내보낸 시각 포함).
 * 다운로드 실패(false)는 onDownloadFailed 로 알린다 — 화면이 시트를 닫고 토스트를 띄운다. 성공이면 시트를 유지한다.
 */
import { useRef, useState } from 'react'
import type { CharacterSettings } from '@shared/types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/TextArea'
import { cx } from '@/components/utils/cx'
import { exportFileName, serializeExportFile, toExportFile } from '@/state/settingsFile'
import { downloadText } from '../download'
import { labels } from '../labels'
import styles from './Sheets.module.css'

/** 안내 줄: 저장하지 않은 변경이 있는 평소(dirty) · 인증 만료(stale) · 없음 */
export type ExportNote = 'dirty' | 'stale' | null

export type ExportSheetProps = {
  target: CharacterSettings
  note: ExportNote
  onClose: () => void
  onDownloadFailed: () => void
}

const noop = (): void => {}

export const ExportSheet = ({ target, note, onClose, onDownloadFailed }: ExportSheetProps) => {
  const [file] = useState(() => {
    const now = new Date()
    return { text: serializeExportFile(toExportFile(target, now)), fileName: exportFileName(now) }
  })
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const download = (): void => {
    if (!downloadText(file.text, file.fileName)) onDownloadFailed()
  }

  return (
    <BottomSheet
      ariaLabel={labels.exportTitle}
      header={<h2 className={styles.title}>{labels.exportTitle}</h2>}
      onClose={onClose}
      initialFocusRef={areaRef}
    >
      {note !== null && (
        <p className={cx(styles.note, note === 'stale' && styles.danger)}>
          {note === 'stale' ? labels.exportStaleNote : labels.exportDirtyNote}
        </p>
      )}
      <TextArea
        value={file.text}
        onChange={noop}
        isReadOnly
        maxRows={6}
        ariaLabel={labels.exportTextAriaLabel}
        textareaRef={areaRef}
      />
      <div className={styles.actions}>
        <Button size="lg" variant="secondary" onClick={onClose}>
          {labels.close}
        </Button>
        <Button size="lg" variant="primary" onClick={download}>
          {labels.saveFile}
        </Button>
      </div>
    </BottomSheet>
  )
}
