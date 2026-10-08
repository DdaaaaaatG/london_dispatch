/**
 * ModelChoice — 설계 settings/design/components.md §3.11 · a11y.md §1 · §3 · 요구 R-SET-013 (settings 로컬, 공용 승격 후보)
 * 「공통」 탭 맨 위 AI 모델 선택: 네이티브 fieldset(이름 = legend, 설명 = 안내 줄) + 라디오 2개(Pro · Flash).
 * 라디오 이름은 aria-label 로 고정하고(설명 문장이 이름에 섞이지 않게) 보이는 이름 span 은 aria-hidden 이다. 설명은 aria-describedby 로 읽힌다.
 * 같은 name 으로 묶어 방향키 이동은 브라우저 기본을 쓴다(키 처리 코드 없음). 저장 중에는 disabled, 값은 제어 값이다(null = 둘 다 unchecked).
 * 모델명(gemini-…)·가격 숫자는 화면에 없다(R-LLM-009). 문구는 labels.ts(§5.1)에서 온다.
 */
import { LLM_MODEL_KEYS } from '@shared/settings'
import type { LlmModelKey } from '@shared/types'
import { cx } from '@/components/utils/cx'
import { labels } from '../labels'
import styles from './ModelChoice.module.css'

export type ModelChoiceProps = {
  /** 모델 선택 초안(state.modelDraft). null = 미선택 판 */
  value: LlmModelKey | null
  /** 저장 중 → 라디오 disabled (stale 에서는 false — 다른 입력과 같다) */
  isReadOnly: boolean
  onChange: (value: LlmModelKey) => void
}

/** 화면에 한 벌뿐이라 고정 문자열이다(탭 id `settings-tab-*` 관례와 같다) */
const GROUP_NAME = 'settings-model'
const NOTE_ID = 'settings-model-note'
const descriptionId = (key: LlmModelKey): string => `settings-model-${key}-desc`

export const ModelChoice = ({ value, isReadOnly, onChange }: ModelChoiceProps) => (
  <fieldset className={styles.root} aria-describedby={NOTE_ID}>
    <legend className={styles.legend}>{labels.modelLegend}</legend>
    {LLM_MODEL_KEYS.map(key => (
      <label key={key} className={cx(styles.option, isReadOnly && styles.disabled)}>
        <input
          type="radio"
          className={styles.radio}
          name={GROUP_NAME}
          value={key}
          checked={value === key}
          disabled={isReadOnly}
          aria-label={labels.modelOption[key].name}
          aria-describedby={descriptionId(key)}
          onChange={() => onChange(key)}
        />
        <span className={styles.name} aria-hidden="true">
          {labels.modelOption[key].name}
        </span>
        <span className={styles.description} id={descriptionId(key)}>
          {labels.modelOption[key].description}
        </span>
      </label>
    ))}
    <p className={styles.note} id={NOTE_ID}>
      {value === null ? labels.modelNoteUnset : labels.modelNoteSelected}
    </p>
  </fieldset>
)
