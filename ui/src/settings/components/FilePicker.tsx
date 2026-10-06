/**
 * FilePicker — 설계 settings/design/components.md §3.9 · 요구 R-SET-008 (settings 로컬, 공용 승격 후보)
 * 「파일 선택」 버튼 + 숨은 input[type=file] + 선택한 파일 이름(없으면 안내 글). 같은 파일을 다시 고를 수 있게 선택 뒤 값을 비운다.
 * 파일 읽기·크기 판정은 호출 쪽 몫이다(여기서는 File 만 넘긴다). 문구는 props 로만 받는다.
 */
import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import styles from './FilePicker.module.css'

export type FilePickerProps = {
  /** 「파일 선택」 */
  label: string
  /** null 이면 emptyText 를 보인다 */
  fileName: string | null
  emptyText: string
  /** 예: 'application/json,.json' */
  accept: string
  onPick: (file: File) => void
  /** 읽는 중 */
  isDisabled?: boolean
}

export const FilePicker = ({
  label,
  fileName,
  emptyText,
  accept,
  onPick,
  isDisabled = false,
}: FilePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file !== undefined) onPick(file)
  }

  return (
    <div className={styles.row}>
      <Button
        size="md"
        variant="secondary"
        isDisabled={isDisabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={handleChange} />
      <span className={styles.name}>{fileName ?? emptyText}</span>
    </div>
  )
}
