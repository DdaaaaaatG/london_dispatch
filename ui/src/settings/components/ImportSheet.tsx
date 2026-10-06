/**
 * ImportSheet(③) — 설계 settings/design/components.md §3.9 · functions.md F-ST-15 ~ F-ST-17 · 요구 R-SET-008 · R-NFR-004
 * 파일 선택 또는 JSON 붙여넣기(하나만) → 「불러오기」. 거부 사유는 오류 줄(role=alert)로 보이고 시트가 유지된다. 초안에만 반영하고 저장은 따로 한다.
 * 입력 상태·읽기·해석은 useImportForm 이 한다. 문구는 labels.ts 에서 온다.
 */
import type { CharacterSettings } from '@shared/types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/TextArea'
import type { ImportSuccess } from '@/state/settingsFile'
import { labels } from '../labels'
import { useImportForm } from '../useImportForm'
import { FilePicker } from './FilePicker'
import styles from './Sheets.module.css'

export type ImportSheetProps = {
  /** 후보 검사 기준 — 마지막으로 읽거나 저장한 값 */
  base: CharacterSettings
  /** 해석 성공. 반영 여부(후보 0개)는 호출 쪽이 정한다 */
  onImported: (result: ImportSuccess) => void
  onClose: () => void
}

const FILE_ACCEPT = 'application/json,.json'

export const ImportSheet = ({ base, onImported, onClose }: ImportSheetProps) => {
  const { form, canSubmit, pickFile, changePaste, submit } = useImportForm({ base, onImported })

  return (
    <BottomSheet
      ariaLabel={labels.importTitle}
      header={<h2 className={styles.title}>{labels.importTitle}</h2>}
      onClose={onClose}
    >
      <FilePicker
        label={labels.chooseFile}
        fileName={form.fileName}
        emptyText={labels.noFileChosen}
        accept={FILE_ACCEPT}
        onPick={pickFile}
        isDisabled={form.isReading}
      />
      <p className={styles.label}>{labels.pasteLabel}</p>
      <TextArea
        value={form.pasteText}
        onChange={changePaste}
        maxRows={5}
        ariaLabel={labels.pasteLabel}
      />
      {form.error !== null && (
        <p className={styles.error} role="alert">
          <span aria-hidden="true">! </span>
          {form.error}
        </p>
      )}
      <p className={styles.hint}>{labels.importNote}</p>
      <div className={styles.actions}>
        <Button size="lg" variant="secondary" onClick={onClose}>
          {labels.cancel}
        </Button>
        <Button size="lg" variant="primary" isDisabled={!canSubmit} onClick={submit}>
          {labels.importSubmit}
        </Button>
      </div>
    </BottomSheet>
  )
}
