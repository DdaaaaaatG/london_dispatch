/**
 * settings(캐릭터 설정) 화면 — 설계 settings/design.md §2~§10 · design/components.md · design/functions.md F-ST-01 ~ F-ST-21
 * 요구: R-SET-007 · 008 · 009 · 010 · 011(참조 R-SET-001 ~ 006) · R-ROOMS-005 · R-NFR-004
 * 갠홈 주인 전용 3번째 화면. 진입 경로는 rooms ⚙ 뿐이다(토큰 없음·비주인은 진입 경로가 없다 — 이 화면은 읽기 전용 판이 없다).
 * 설정은 들어올 때마다 다시 읽고(F-ST-03), 공통 세계관·세바스찬·시엘 탭 3개로 초안을 고쳐 「저장」으로 서버에 맡긴다. 파일 내보내기·가져오기는 ⋯ 시트다.
 * 요청·전이는 useSettingsEditor + state/settings 리듀서, 탭·시트·포커스는 useSettingsUi 가 한다. 여기서는 조립과 렌더만 한다.
 * 화면은 토큰을 읽지도 저장하지도 않는다(Authorization 헤더는 @/api 래퍼가 붙인다). 인증 실패는 onAuthFailure 로 App 에 알린다.
 */
import { useEffect } from 'react'
import type { Dispatch } from 'react'
import { useToast } from '@/components/hooks/useToast'
import type { ToastState } from '@/components/hooks/useToast'
import { IconButton } from '@/components/ui/IconButton'
import { StateView } from '@/components/ui/StateView'
import type { ToastProps, ToastTone } from '@/components/ui/Toast'
import { TopBar } from '@/components/ui/TopBar'
import type { SettingsAction, SettingsState } from '@/state/settings'
import type { ImportSuccess } from '@/state/settingsFile'
import { ReadyBody } from './components/ReadyBody'
import { SheetLayer } from './components/SheetLayer'
import { labels } from './labels'
import styles from './styles/SettingsScreen.module.css'
import { useSettingsEditor } from './useSettingsEditor'
import { useSettingsUi } from './useSettingsUi'

export type SettingsScreenProps = {
  /** rooms 로 간다. notice 가 있으면 rooms 가 마운트 때 토스트로 1회 띄운다 */
  onLeave: (notice?: ToastProps) => void
  /** 열기·저장의 인증 3코드 — App 이 읽기 전용으로 전환한다 */
  onAuthFailure: () => void
  /** 열기·저장의 OWNER_ONLY — App 이 ⚙ 를 내린다 */
  onOwnerLost: () => void
}

type Ui = ReturnType<typeof useSettingsUi>

/** 후보가 하나도 없는 성공(맞는 형식이지만 쓸 값이 없음) */
const isNothingApplied = ({ applied }: ImportSuccess): boolean =>
  !applied.world && applied.sebastian === 0 && applied.ciel === 0

type SheetResultOptions = {
  dispatch: Dispatch<SettingsAction>
  showToast: (message: string, tone: ToastTone) => void
  closeSheet: () => void
}

/** 시트 결과 처리. 시트가 열린 동안은 토스트를 띄우지 않으므로 먼저 닫고 띄운다(F-ST-14 · F-ST-17) */
const createSheetResults = ({ dispatch, showToast, closeSheet }: SheetResultOptions) => ({
  /** 후보 0개면 초안을 바꾸지 않고 알린다. 아니면 후보 위치만 초안에 덮는다(저장하지 않는다) */
  onImported: (result: ImportSuccess): void => {
    closeSheet()
    if (isNothingApplied(result)) {
      showToast(labels.importNothing(result.ignoredCount), 'warning')
      return
    }
    dispatch({ type: 'imported', patch: result.patch })
    showToast(labels.importSummary(result), 'success')
  },
  onDownloadFailed: (): void => {
    closeSheet()
    showToast(labels.fileSaveFailed, 'warning')
  },
})

/** 상단 바: ‹ 뒤로 + (ready 일 때만) ⋯ 설정 파일 메뉴. 저장 중에는 둘 다 비활성 */
const SettingsTopBar = ({ state, ui }: { state: SettingsState; ui: Ui }) => {
  const isSaving = state.phase === 'ready' && state.isSaving
  return (
    <TopBar
      title={labels.screenTitle}
      titleRef={ui.titleRef}
      left={
        <IconButton
          icon="back"
          ariaLabel={labels.backAriaLabel}
          onClick={ui.requestBack}
          isDisabled={isSaving}
          buttonRef={ui.backButtonRef}
        />
      }
      right={
        state.phase === 'ready' ? (
          <IconButton
            icon="more"
            ariaLabel={labels.fileMenuAriaLabel}
            onClick={ui.openFileMenu}
            isDisabled={isSaving}
            buttonRef={ui.fileMenuButtonRef}
          />
        ) : undefined
      }
    />
  )
}

type BodyProps = {
  state: SettingsState
  ui: Ui
  toast: ToastState
  dispatch: Dispatch<SettingsAction>
  onSave: () => void
  onRetry: () => void
}

/** 본문: 판정 순서 error → loading → data. loading · error 에는 내보낼 값이 없어 ⋯ 도 없다 */
const SettingsBody = ({ state, ui, toast, dispatch, onSave, onRetry }: BodyProps) => {
  if (state.phase === 'error') {
    return (
      <StateView
        kind="error"
        message={labels.loadError}
        detail={labels.loadErrorDetail(state.error.code)}
        actionLabel={labels.retry}
        onAction={onRetry}
      />
    )
  }
  if (state.phase === 'loading') return <StateView kind="loading" message={labels.loading} />
  return (
    <ReadyBody
      state={state}
      activeTab={ui.activeTab}
      toast={toast}
      saveButtonRef={ui.saveButtonRef}
      onSelectTab={ui.selectTab}
      onChangeWorld={value => dispatch({ type: 'worldChanged', value })}
      onChangeField={(id, key, value) =>
        dispatch({ type: 'characterFieldChanged', id, key, value })
      }
      onRevert={() => dispatch({ type: 'reverted' })}
      onSave={onSave}
    />
  )
}

export const SettingsScreen = ({ onLeave, onAuthFailure, onOwnerLost }: SettingsScreenProps) => {
  const { toast, showToast } = useToast()
  const editor = useSettingsEditor({ onAuthFailure, onOwnerLost, onLeave, showToast })
  const { state, dispatch, loadSettings, saveSettings } = editor
  const ui = useSettingsUi({ state, focusTargetRef: editor.focusTargetRef, onLeave })
  const results = createSheetResults({ dispatch, showToast, closeSheet: ui.closeSheet })
  const { titleRef } = ui

  // F-ST-01: 마운트 시 h1 포커스 → 설정 읽기
  useEffect(() => {
    titleRef.current?.focus()
    void loadSettings()
  }, [titleRef, loadSettings])

  return (
    <main className={styles.root} aria-label={labels.screenTitle}>
      <SettingsTopBar state={state} ui={ui} />
      <SettingsBody
        state={state}
        ui={ui}
        toast={toast}
        dispatch={dispatch}
        onSave={() => void saveSettings()}
        onRetry={editor.retryLoad}
      />
      {state.phase === 'ready' && (
        <SheetLayer
          sheet={ui.sheet}
          state={state}
          onClose={ui.closeSheet}
          onExport={ui.openExport}
          onImport={ui.openImport}
          onImported={results.onImported}
          onDownloadFailed={results.onDownloadFailed}
          onConfirmLeave={ui.confirmLeave}
        />
      )}
    </main>
  )
}
