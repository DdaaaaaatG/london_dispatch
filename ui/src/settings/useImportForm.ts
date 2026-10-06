/**
 * useImportForm — 설계 settings/design/functions.md F-ST-15 ~ F-ST-17 · state.md §1(③ 로컬 상태) (ImportSheet 50줄 한계 분리)
 * 요구: R-SET-008 · R-NFR-004 · D-ST-9
 * ③ 가져오기 시트의 입력 상태(파일 · 붙여넣기 · 오류 · 읽는 중)를 소유한다. 파일과 붙여넣기는 하나만 쓴다(나중 입력이 앞 입력을 지운다).
 * 파일은 5MB 를 넘으면 읽기 전에 거부하고, FileReader 로 텍스트를 읽는다. 시트가 닫힌 뒤(또는 다른 입력으로 바뀐 뒤) 도착한 결과는 무시한다.
 * 해석은 parseImportFile(순수)이 한다. 가져오기는 저장하지 않는다 — 성공은 onImported 로 알리기만 한다.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { SETTINGS_IMPORT_MAX_BYTES } from '@shared/settings'
import type { CharacterSettings } from '@shared/types'
import { parseImportFile } from '@/state/settingsFile'
import type { ImportSuccess } from '@/state/settingsFile'
import { labels } from './labels'

export type ImportForm = {
  fileName: string | null
  fileText: string | null
  pasteText: string
  error: string | null
  isReading: boolean
}

export type UseImportFormOptions = {
  /** 후보 검사 기준 = 마지막으로 읽거나 저장한 값(state.base.settings) */
  base: CharacterSettings
  onImported: (result: ImportSuccess) => void
}

export type UseImportFormResult = {
  form: ImportForm
  canSubmit: boolean
  pickFile: (file: File) => void
  changePaste: (value: string) => void
  submit: () => void
}

const INITIAL_FORM: ImportForm = {
  fileName: null,
  fileText: null,
  pasteText: '',
  error: null,
  isReading: false,
}

/** 텍스트를 읽어 알린다. 실패하면 null */
const readText = (file: File, onDone: (text: string | null) => void): void => {
  const reader = new FileReader()
  reader.onload = () => onDone(typeof reader.result === 'string' ? reader.result : '')
  reader.onerror = () => onDone(null)
  reader.readAsText(file, 'utf-8')
}

export const useImportForm = ({ base, onImported }: UseImportFormOptions): UseImportFormResult => {
  const [form, setForm] = useState<ImportForm>(INITIAL_FORM)
  const isActiveRef = useRef(false)
  /** 입력이 바뀔 때마다 올린다 — 앞선 읽기 결과가 뒤늦게 도착해도 버린다 */
  const inputIdRef = useRef(0)

  useLayoutEffect(() => {
    isActiveRef.current = true
    return () => {
      isActiveRef.current = false
    }
  }, [])

  /** F-ST-15: 5MB 초과는 읽지 않고 거부(파일 이름은 보여 준다) */
  const pickFile = (file: File): void => {
    inputIdRef.current += 1
    const inputId = inputIdRef.current
    if (file.size > SETTINGS_IMPORT_MAX_BYTES) {
      const error = labels.importFailureText({ ok: false, reason: 'tooLarge' })
      setForm({ ...INITIAL_FORM, fileName: file.name, error })
      return
    }
    setForm({ ...INITIAL_FORM, fileName: file.name, isReading: true })
    readText(file, text => {
      if (!isActiveRef.current || inputIdRef.current !== inputId) return
      const error = labels.importFailureText({ ok: false, reason: 'readFailed' })
      setForm(prev =>
        text === null
          ? { ...prev, error, isReading: false }
          : { ...prev, fileText: text, isReading: false },
      )
    })
  }

  /** F-ST-16 */
  const changePaste = (value: string): void => {
    inputIdRef.current += 1
    setForm({ ...INITIAL_FORM, pasteText: value })
  }

  /** F-ST-17: 파일 텍스트가 있으면 그것, 없으면 붙여넣기. 거부면 오류 줄(초안 불변), 성공이면 화면에 넘긴다 */
  const submit = (): void => {
    const result = parseImportFile(form.fileText ?? form.pasteText, base)
    if (result.ok) onImported(result)
    else setForm(prev => ({ ...prev, error: labels.importFailureText(result) }))
  }

  const hasInput = form.fileText !== null || form.pasteText.trim() !== ''
  return { form, canSubmit: !form.isReading && hasInput, pickFile, changePaste, submit }
}
