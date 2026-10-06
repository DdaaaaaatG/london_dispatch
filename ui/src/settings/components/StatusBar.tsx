/**
 * StatusBar(D) — 설계 settings/design/components.md §3.5 · 요구 R-SET-009 · R-SET-011
 * 하단 36px 한 줄: 상태 문구(role=status · aria-live=polite · 한 줄 말줄임) + 「되돌리기」 + 「저장」.
 * 버튼은 조건이 안 맞으면 **비활성**이다(미렌더 아님). 색은 상태로 가른다: 저장 중·저장됨·기본값 = muted · dirty = warning · 위반·인증 만료 = danger.
 * 문구는 labels.ts(statusText · revert · save)에서 온다.
 */
import type { Ref } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/utils/cx'
import type { SettingsStatus } from '@/state/settings'
import { labels } from '../labels'
import styles from './StatusBar.module.css'

export type StatusBarProps = {
  status: SettingsStatus
  canRevert: boolean
  canSave: boolean
  onRevert: () => void
  onSave: () => void
  /** 저장 실패 뒤 포커스 복귀 대상(F-ST-10) */
  saveButtonRef: Ref<HTMLButtonElement>
}

type StatusTone = 'muted' | 'warning' | 'danger'

const toneOf = (status: SettingsStatus): StatusTone => {
  switch (status.kind) {
    case 'stale':
    case 'invalid':
      return 'danger'
    case 'dirty':
      return 'warning'
    default:
      return 'muted'
  }
}

export const StatusBar = ({
  status,
  canRevert,
  canSave,
  onRevert,
  onSave,
  saveButtonRef,
}: StatusBarProps) => (
  <div className={styles.bar}>
    <p className={cx(styles.text, styles[toneOf(status)])} role="status" aria-live="polite">
      {labels.statusText(status)}
    </p>
    <Button size="md" variant="secondary" isDisabled={!canRevert} onClick={onRevert}>
      {labels.revert}
    </Button>
    <Button
      size="md"
      variant="primary"
      isDisabled={!canSave}
      onClick={onSave}
      buttonRef={saveButtonRef}
    >
      {labels.save}
    </Button>
  </div>
)
