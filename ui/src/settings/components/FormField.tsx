/**
 * FormField — 설계 settings/design/components.md §3.3 · 요구 R-SET-009 · R-SET-002 (settings 로컬, 공용 승격 후보)
 * 라벨 줄(라벨 + 필수 `*` + 목록 줄 카운터) · 입력(children) · 필드 아래 안내 한 줄.
 * 라벨은 보이는 글자다. 입력의 접근성 이름은 children 의 ariaLabel 이 맡는다(공용 입력에 label 연결이 없다).
 * 안내 줄은 live region 이 아니다(입력할 때마다 읽히지 않게). 상한 초과는 공용 입력의 aria-invalid 가 알린다.
 * settings 로컬 컴포넌트라 필수 표시 글자(labels.requiredMark)는 labels.ts 에서 직접 읽는다.
 */
import type { ReactNode } from 'react'
import { cx } from '@/components/utils/cx'
import { labels } from '../labels'
import styles from './FormField.module.css'

export type FormFieldProps = {
  /** spec.label (+ 목록 필드는 힌트) */
  label: string
  /** 라벨 뒤 `*`(aria-hidden) */
  isRequired: boolean
  /** 필드 아래 안내 한 줄(없으면 null) */
  issueText: string | null
  /** 목록 필드: 라벨 줄 오른쪽 `n/10줄` */
  counter?: string | undefined
  /** counter 를 danger 색으로 */
  isCounterOver?: boolean
  /** 나이·성별 2열(그리드 칸이 줄어들 수 있게 한다) */
  halfWidth?: boolean
  children: ReactNode
}

export const FormField = ({
  label,
  isRequired,
  issueText,
  counter,
  isCounterOver = false,
  halfWidth = false,
  children,
}: FormFieldProps) => (
  <div className={cx(styles.field, halfWidth && styles.half)}>
    <div className={styles.labelRow}>
      <span className={styles.label}>
        {label}
        {isRequired && (
          <span className={styles.required} aria-hidden="true">
            {labels.requiredMark}
          </span>
        )}
      </span>
      {counter !== undefined && (
        <span className={cx(styles.counter, isCounterOver && styles.over)} aria-hidden="true">
          {counter}
        </span>
      )}
    </div>
    {children}
    {issueText !== null && <p className={styles.issue}>{issueText}</p>}
  </div>
)
