/**
 * ReadyBody — 설계 settings/design/components.md §1 트리 · §3.11 · §4 세로 배분 · 요구 R-SET-009 · R-SET-011 · R-SET-013
 * ready 일 때의 본문: B 탭 줄 · C 폼 영역(tabpanel, 스크롤) · E 토스트 · F stale 안내 · D 하단 줄.
 * (S3f) 「공통」 탭의 C 영역은 위에 AI 모델 묶음(ModelChoice), 아래에 세계관(WorldForm)이다. 캐릭터 탭에는 모델 묶음이 없다.
 * 파생 값(하단 줄 상태 · 되돌리기·저장 활성 · 탭 `!`)은 state 에서 순수 함수로 계산한다. 전이 규칙을 여기서 다시 쓰지 않는다.
 * 초안은 리듀서에 있어 탭을 바꿔도 유지된다. 탭을 바꾸면 폼 영역 스크롤을 맨 위로 되돌린다(F-ST-06).
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Ref } from 'react'
import type { CharacterId, CharacterSettingFields, LlmModelKey } from '@shared/types'
import type { ToastState } from '@/components/hooks/useToast'
import { Toast } from '@/components/ui/Toast'
import {
  SETTINGS_TABS,
  canRevertSettings,
  canSaveSettings,
  statusOf,
  tabHasIssue,
} from '@/state/settings'
import type { ReadyState, SettingsTab } from '@/state/settings'
import { labels } from '../labels'
import { CharacterForm } from './CharacterForm'
import { ModelChoice } from './ModelChoice'
import { StaleNotice } from './StaleNotice'
import { StatusBar } from './StatusBar'
import { Tabs, panelDomId, tabDomId } from './Tabs'
import { WorldForm } from './WorldForm'
import styles from './ReadyBody.module.css'

/** 탭·패널 DOM id 접두사: `settings-tab-{id}` · `settings-panel` */
const ID_PREFIX = 'settings'

export type ReadyBodyProps = {
  state: ReadyState
  activeTab: SettingsTab
  toast: ToastState
  saveButtonRef: Ref<HTMLButtonElement>
  onSelectTab: (tab: SettingsTab) => void
  onChangeWorld: (value: string) => void
  onChangeField: (id: CharacterId, key: keyof CharacterSettingFields, value: string) => void
  onChangeModel: (value: LlmModelKey) => void
  onRevert: () => void
  onSave: () => void
}

type FormPanelProps = Pick<
  ReadyBodyProps,
  'state' | 'activeTab' | 'onChangeWorld' | 'onChangeField' | 'onChangeModel'
>

/** C 폼 영역(tabpanel). 이 요소가 스크롤 컨테이너다 — 탭이 바뀌면 맨 위로 되돌린다 */
const FormPanel = ({
  state,
  activeTab,
  onChangeWorld,
  onChangeField,
  onChangeModel,
}: FormPanelProps) => {
  const panelRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (panelRef.current !== null) panelRef.current.scrollTop = 0
  }, [activeTab])

  return (
    <section
      ref={panelRef}
      id={panelDomId(ID_PREFIX)}
      className={styles.panel}
      role="tabpanel"
      aria-labelledby={tabDomId(ID_PREFIX, activeTab)}
    >
      {activeTab === 'world' ? (
        <>
          <ModelChoice
            value={state.modelDraft}
            isReadOnly={state.isSaving}
            onChange={onChangeModel}
          />
          <WorldForm draft={state.draft} isReadOnly={state.isSaving} onChange={onChangeWorld} />
        </>
      ) : (
        <CharacterForm
          key={activeTab}
          id={activeTab}
          draft={state.draft}
          isReadOnly={state.isSaving}
          onChange={(key, value) => onChangeField(activeTab, key, value)}
        />
      )}
    </section>
  )
}

export const ReadyBody = (props: ReadyBodyProps) => {
  const { state, activeTab, toast, saveButtonRef, onSelectTab, onRevert, onSave } = props
  const derived = useMemo(
    () => ({
      status: statusOf(state),
      canRevert: canRevertSettings(state),
      canSave: canSaveSettings(state),
      tabs: SETTINGS_TABS.map(tab => ({
        id: tab,
        label: labels.tabLabel[tab],
        hasIssue: tabHasIssue(state.draft, tab),
      })),
    }),
    [state],
  )

  return (
    <>
      <Tabs
        items={derived.tabs}
        activeId={activeTab}
        onSelect={onSelectTab}
        ariaLabel={labels.tabListAriaLabel}
        idPrefix={ID_PREFIX}
        issueSuffix={labels.tabIssueSuffix}
      />
      <FormPanel {...props} />
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} />}
      {state.isStale && <StaleNotice message={labels.staleNotice} />}
      <StatusBar
        status={derived.status}
        canRevert={derived.canRevert}
        canSave={derived.canSave}
        onRevert={onRevert}
        onSave={onSave}
        saveButtonRef={saveButtonRef}
      />
    </>
  )
}
