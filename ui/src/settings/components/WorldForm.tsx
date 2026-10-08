/**
 * WorldForm — 설계 settings/design/components.md §3.4 · 요구 R-SET-009 · R-SET-002
 * 「공통」 탭의 세계관 입력: 필수 글 필드 하나. 라벨·상한·필수는 shared WORLD_FIELD_SPEC 이 단일 소스다. (같은 탭 위에 ModelChoice 가 있다)
 * 구성안의 "C 높이를 채움"은 maxRows 와 폼 영역 flex 로 근사한다(design.md §12 차이 2).
 */
import { WORLD_FIELD_SPEC } from '@shared/settings'
import { TextArea } from '@/components/ui/TextArea'
import { fieldIssueOf } from '@/state/settings'
import type { SettingsDraft } from '@/state/settings'
import { labels } from '../labels'
import { FormField } from './FormField'
import styles from './WorldForm.module.css'

export type WorldFormProps = {
  draft: SettingsDraft
  /** 저장 중 */
  isReadOnly: boolean
  onChange: (value: string) => void
}

/** 같은 탭 위에 모델 묶음(169px)이 있어 16 → 9. 필드 안내 줄까지 스크롤 없이 보이는 최대 줄 수(components.md §4.1) */
const WORLD_MAX_ROWS = 9

export const WorldForm = ({ draft, isReadOnly, onChange }: WorldFormProps) => {
  const issue = fieldIssueOf(draft, { tab: 'world' })
  return (
    <div className={styles.form}>
      <FormField
        label={WORLD_FIELD_SPEC.label}
        isRequired={WORLD_FIELD_SPEC.required}
        issueText={issue === null ? null : labels.fieldIssueText(issue)}
      >
        <div className={styles.area}>
          <TextArea
            value={draft.world}
            onChange={onChange}
            ariaLabel={labels.requiredAria(WORLD_FIELD_SPEC.label)}
            maxChars={WORLD_FIELD_SPEC.max}
            counterMode="always"
            maxRows={WORLD_MAX_ROWS}
            isReadOnly={isReadOnly}
          />
        </div>
      </FormField>
    </div>
  )
}
