/**
 * MemorySheet(장기기억 시트) — 설계 chat/design/memory.md ME §0 · §1.2 · §1.3 · §7 · F-CH-54 · F-CH-62 · 요구 R-CHAT-012 🔒 · R-CHAT-013 🔒 · R-MEM-001 🔒
 * 비유: 일기장 맨 앞에 끼워 둔 "지난 줄거리" 쪽지를 펼쳐 고치는 작은 책상이다. 고친 것을 저장하지 않고 덮으려 하면 한 번 묻는다.
 * 컨테이너(MemorySheet)가 useMemorySheet 를 소유한다. 버림 확인 중에는 MemoryEditor 대신 ConfirmDialog 를 바꿔 그린다(시트 두 장을
 * 겹치지 않는다, D-34). 컨테이너는 계속 마운트되어 있어 초안·조회 결과가 남고, 시트를 열 때마다 새로 마운트되어 매번 다시 조회한다.
 * 공용 BottomSheet · Button · TextArea(카운터 always) · StateView · ConfirmDialog 만 조립하고, 문구는 labels.ts 에서만 온다.
 * ChatScreen 이 viewer.canWrite 일 때만 이 시트를 렌더한다(토큰 없으면 DOM 에 없다).
 */
import { useId, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ApiError } from '@/api'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StateView } from '@/components/ui/StateView'
import { TextArea } from '@/components/ui/TextArea'
import { formatMonthDay, formatTime, toIsoDateTime } from '@/components/utils/formatDate'
import { labels, writeErrorText } from '@/chat/labels'
import { type UseMemorySheetResult, useMemorySheet } from '@/chat/useMemorySheet'
import { MEMORY_SUMMARY_MAX_CHARS, type MemoryLoad } from '@/state/memory'
import styles from './MenuSheets.module.css'

export type MemorySheetProps = {
  roomId: string
  /** 변경 없이 닫기 · 버리기 확정 → 시트 닫기 */
  onClose: () => void
  /** 저장 성공 → 시트 닫기 + 성공 토스트(F-CH-60) */
  onSaved: () => void
  /** 인증 3종 · NOT_FOUND → 시트 닫고 화면 공통 처리(F-CH-60) */
  onLeave: (error: ApiError) => void
}

type MemoryEditorProps = { memory: UseMemorySheetResult }

/** 입력 최대 줄 수(약 156px). 넘으면 TextArea 안에서 스크롤한다. 높이 ≤ 480 화면은 공용 규칙대로 1줄로 고정된다 */
const MEMORY_MAX_ROWS = 7

type TextareaRef = RefObject<HTMLTextAreaElement | null>

/**
 * F-CH-62: 조회가 끝나(loading·error → ready) 입력이 생긴 렌더에서 입력으로 포커스하고 요약 첫머리를 보인다.
 * 마운트 때 이미 ready 면(버림 확인에서 돌아옴) BottomSheet 의 initialFocusRef 가 포커스를 맡으므로 하지 않는다
 */
const useFocusWhenReady = (phase: MemoryLoad['phase'], textareaRef: TextareaRef): void => {
  const previousPhaseRef = useRef(phase)
  useLayoutEffect(() => {
    const previous = previousPhaseRef.current
    previousPhaseRef.current = phase
    const input = textareaRef.current
    if (phase !== 'ready' || previous === 'ready' || input === null) return
    input.focus()
    input.setSelectionRange(0, 0)
    input.scrollTop = 0
  }, [phase, textareaRef])
}

type MemoryHeaderProps = { isSaving: boolean; onClose: () => void }

/** 머리 줄: 제목 h2 + 닫기(저장 중에는 잠금) */
const MemoryHeader = ({ isSaving, onClose }: MemoryHeaderProps) => (
  <div className={styles.memoryHeader}>
    <h2 className={styles.memoryTitle}>{labels.memory}</h2>
    <Button size="sm" variant="ghost" isDisabled={isSaving} onClick={onClose}>
      {labels.memoryClose}
    </Button>
  </div>
)

/** 갱신 줄: 앞말 + 공용 날짜 서식(MM.DD HH:mm). 한 번도 저장되지 않았으면(updatedAt null) 호출하지 않는다 */
const UpdatedAtLine = ({ epochMs }: { epochMs: number }) => {
  const text = `${formatMonthDay(epochMs)} ${formatTime(epochMs)}`
  return (
    <p className={styles.memoryMeta}>
      {labels.memoryUpdatedAtPrefix} <time dateTime={toIsoDateTime(epochMs)}>{text}</time>
    </p>
  )
}

type MemoryBodyProps = {
  memory: UseMemorySheetResult
  textareaRef: TextareaRef
  /** 초과 안내 줄 id — 저장 버튼 aria-describedby 가 가리킨다 */
  overNoteId: string
}

type MemoryReadyBodyProps = MemoryBodyProps & { updatedAt: number | null }

/** 조회됨: 갱신 줄 · 입력(카운터 항상) · 초과 안내 · 저장 실패 문구 */
const MemoryReadyBody = ({ memory, updatedAt, textareaRef, overNoteId }: MemoryReadyBodyProps) => (
  <>
    {updatedAt !== null && <UpdatedAtLine epochMs={updatedAt} />}
    <TextArea
      value={memory.draft}
      onChange={memory.setDraft}
      ariaLabel={labels.memoryInputAriaLabel}
      placeholder={labels.memoryPlaceholder}
      maxRows={MEMORY_MAX_ROWS}
      maxChars={MEMORY_SUMMARY_MAX_CHARS}
      counterMode="always"
      textareaRef={textareaRef}
      isReadOnly={memory.isSaving}
    />
    {memory.isOver && (
      <p id={overNoteId} className={styles.memoryOver}>
        {labels.memoryOverNote}
      </p>
    )}
    {memory.saveError !== null && (
      <p className={styles.memoryError} role="alert">
        {memory.saveError}
      </p>
    )}
  </>
)

/** 본문 자리(안내 줄 아래). 판정 순서 error → loading → data */
const MemoryBody = ({ memory, textareaRef, overNoteId }: MemoryBodyProps) => {
  const { load } = memory
  if (load.phase === 'error') {
    return (
      <StateView
        kind="error"
        message={labels.memoryLoadError}
        detail={writeErrorText(load.error, 'memory')}
        actionLabel={labels.retry}
        onAction={memory.retryLoad}
      />
    )
  }
  if (load.phase === 'loading') return <StateView kind="loading" message={labels.memoryLoading} />
  return (
    <MemoryReadyBody
      memory={memory}
      updatedAt={load.base.updatedAt}
      textareaRef={textareaRef}
      overNoteId={overNoteId}
    />
  )
}

type MemoryActionsProps = { memory: UseMemorySheetResult; overNoteId: string }

/** 하단 버튼 줄: 취소 secondary 왼쪽 · 저장 primary 오른쪽. 초과면 저장이 안내 줄을 aria-describedby 로 잇는다 */
const MemoryActions = ({ memory, overNoteId }: MemoryActionsProps) => (
  <div className={styles.memoryActions}>
    <Button
      size="lg"
      variant="secondary"
      isDisabled={memory.isSaving}
      onClick={memory.requestClose}
    >
      {labels.cancel}
    </Button>
    <Button
      size="lg"
      variant="primary"
      isDisabled={!memory.canSave}
      onClick={memory.save}
      ariaDescribedBy={memory.isOver ? overNoteId : undefined}
    >
      {labels.save}
    </Button>
  </div>
)

/** 시트 본체. 저장 중에는 Esc·덮개로 닫히지 않는다(isDismissDisabled) */
const MemoryEditor = ({ memory }: MemoryEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overNoteId = useId()
  useFocusWhenReady(memory.load.phase, textareaRef)

  return (
    <BottomSheet
      ariaLabel={labels.memory}
      header={<MemoryHeader isSaving={memory.isSaving} onClose={memory.requestClose} />}
      onClose={memory.requestClose}
      isDismissDisabled={memory.isSaving}
      initialFocusRef={textareaRef}
    >
      <p className={styles.memoryNote}>{labels.memoryGuide}</p>
      <MemoryBody memory={memory} textareaRef={textareaRef} overNoteId={overNoteId} />
      <MemoryActions memory={memory} overNoteId={overNoteId} />
    </BottomSheet>
  )
}

export const MemorySheet = (props: MemorySheetProps) => {
  const memory = useMemorySheet(props)
  return memory.isAskingDiscard ? (
    <ConfirmDialog
      title={labels.memoryDiscardTitle}
      message={labels.memoryDiscardBody}
      confirmLabel={labels.memoryDiscardConfirm}
      cancelLabel={labels.memoryKeepEditing}
      onConfirm={memory.confirmDiscard}
      onCancel={memory.keepEditing}
    />
  ) : (
    <MemoryEditor memory={memory} />
  )
}
