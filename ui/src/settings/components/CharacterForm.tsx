/**
 * CharacterForm — 설계 settings/design/components.md §3.4 · 요구 R-SET-009 · R-SET-002 · R-SET-006
 * 캐릭터 탭: 필드 11개를 묶음 3개(기본 정보 · 인물 · 말투·규칙)로 보여 준다. 나이·성별은 같은 줄 2열. outputRules 는 없다(편집 불가).
 * 라벨·필수·상한·개수는 shared CHARACTER_FIELD_SPECS 가 단일 소스다(숫자를 여기 적지 않는다). 목록 필드는 "한 줄에 하나" TextArea 이고 줄 수는 라벨 줄에 보인다.
 * Enter 는 줄바꿈이다(onEnter 없음). 상한을 넘어도 잘라 내지 않는다(안내·탭 `!`·저장 비활성으로 알린다).
 */
import { CHARACTER_FIELD_SPECS } from '@shared/settings'
import type { ListFieldSpec, TextFieldSpec } from '@shared/settings'
import type { CharacterId, CharacterSettingFields } from '@shared/types'
import { TextArea } from '@/components/ui/TextArea'
import { TextInput } from '@/components/ui/TextInput'
import { fieldCount, fieldIssueOf } from '@/state/settings'
import type { SettingsDraft } from '@/state/settings'
import { labels } from '../labels'
import { FormField } from './FormField'
import styles from './CharacterForm.module.css'

type FieldKey = keyof CharacterSettingFields

export type CharacterFormProps = {
  id: CharacterId
  draft: SettingsDraft
  /** 저장 중 */
  isReadOnly: boolean
  onChange: (key: FieldKey, value: string) => void
}

/** 묶음별 줄 배치. 한 줄에 둘이면 2열(나이 · 성별) */
const GROUPS: ReadonlyArray<{ title: string; rows: ReadonlyArray<readonly FieldKey[]> }> = [
  { title: labels.groupBasic, rows: [['sourceMaterial'], ['age', 'gender'], ['role']] },
  {
    title: labels.groupPersona,
    rows: [['persona'], ['personalityTags'], ['appearance'], ['relationships']],
  },
  { title: labels.groupSpeech, rows: [['speech'], ['sampleDialogue'], ['rules']] },
]

/** TextArea 로 그리는 필드의 최대 줄 수. 표에 없는 필드는 한 줄 TextInput(원작·나이·성별·신분) */
const AREA_MAX_ROWS: Partial<Record<FieldKey, number>> = {
  persona: 10,
  personalityTags: 4,
  appearance: 8,
  relationships: 8,
  speech: 8,
  sampleDialogue: 10,
  rules: 12,
}
const DEFAULT_MAX_ROWS = 8

type FieldProps = {
  id: CharacterId
  fieldKey: FieldKey
  draft: SettingsDraft
  isReadOnly: boolean
  onChange: (key: FieldKey, value: string) => void
}

/** 성격 태그만 최소 2줄, 그 밖 TextArea 는 최소 3줄(공용 TextArea 에 최소 줄 prop 이 없어 화면 CSS 로 맞춘다) */
const minRowsClass = (key: FieldKey): string | undefined =>
  key === 'personalityTags' ? styles.rows2 : styles.rows3

/** 필드 아래 안내 한 줄(문제가 없으면 null) */
const issueTextOf = (draft: SettingsDraft, id: CharacterId, key: FieldKey): string | null => {
  const issue = fieldIssueOf(draft, { tab: id, key })
  return issue === null ? null : labels.fieldIssueText(issue)
}

/** 글 필드: 한 줄이면 TextInput, 여러 줄이면 TextArea. 상한 카운터는 공용 입력이 그린다 */
const TextField = ({
  spec,
  id,
  fieldKey,
  draft,
  isReadOnly,
  onChange,
}: FieldProps & { spec: TextFieldSpec }) => {
  const value = draft.characters[id][fieldKey]
  const ariaLabel = spec.required ? labels.requiredAria(spec.label) : spec.label
  const handleChange = (next: string): void => onChange(fieldKey, next)
  const maxRows = AREA_MAX_ROWS[fieldKey]
  return (
    <FormField
      label={spec.label}
      isRequired={spec.required}
      issueText={issueTextOf(draft, id, fieldKey)}
      halfWidth={fieldKey === 'age' || fieldKey === 'gender'}
    >
      {maxRows === undefined ? (
        <TextInput
          value={value}
          onChange={handleChange}
          ariaLabel={ariaLabel}
          maxChars={spec.max}
          isReadOnly={isReadOnly}
        />
      ) : (
        <div className={minRowsClass(fieldKey)}>
          <TextArea
            value={value}
            onChange={handleChange}
            ariaLabel={ariaLabel}
            maxChars={spec.max}
            counterMode="always"
            maxRows={maxRows}
            isReadOnly={isReadOnly}
          />
        </div>
      )}
    </FormField>
  )
}

/** 목록 필드: "한 줄에 하나" TextArea. 줄 수 카운터는 라벨 줄 오른쪽, 입력 이름은 힌트 없는 라벨이다 */
const ListField = ({
  spec,
  id,
  fieldKey,
  draft,
  isReadOnly,
  onChange,
}: FieldProps & { spec: ListFieldSpec }) => {
  const { count, max } = fieldCount(draft, { tab: id, key: fieldKey })
  return (
    <FormField
      label={`${spec.label} ${labels.listHint(spec.maxItems)}`}
      isRequired={false}
      issueText={issueTextOf(draft, id, fieldKey)}
      counter={labels.lineCounter(count, max)}
      isCounterOver={count > max}
    >
      <div className={styles.rows3}>
        <TextArea
          value={draft.characters[id][fieldKey]}
          onChange={next => onChange(fieldKey, next)}
          ariaLabel={spec.label}
          maxRows={AREA_MAX_ROWS[fieldKey] ?? DEFAULT_MAX_ROWS}
          isReadOnly={isReadOnly}
        />
      </div>
    </FormField>
  )
}

const CharacterField = (props: FieldProps) => {
  const spec = CHARACTER_FIELD_SPECS[props.fieldKey]
  return spec.kind === 'text' ? (
    <TextField {...props} spec={spec} />
  ) : (
    <ListField {...props} spec={spec} />
  )
}

export const CharacterForm = ({ id, draft, isReadOnly, onChange }: CharacterFormProps) => (
  <div className={styles.form}>
    {GROUPS.map(group => (
      <div key={group.title} className={styles.group}>
        <h2 className={styles.groupTitle}>{group.title}</h2>
        {group.rows.map(row => (
          <div key={row.join('-')} className={row.length > 1 ? styles.pair : styles.row}>
            {row.map(fieldKey => (
              <CharacterField
                key={fieldKey}
                id={id}
                fieldKey={fieldKey}
                draft={draft}
                isReadOnly={isReadOnly}
                onChange={onChange}
              />
            ))}
          </div>
        ))}
      </div>
    ))}
  </div>
)
