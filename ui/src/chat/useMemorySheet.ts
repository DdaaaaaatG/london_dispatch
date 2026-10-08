/**
 * useMemorySheet — 설계 chat/design/memory.md ME §2 · §3 F-CH-55 ~ F-CH-59 · D-33 · D-36 · D-37 · D-41
 * 요구: R-CHAT-012 🔒 · R-CHAT-011 · R-MEM-001 🔒
 * 장기기억 시트가 열려 있는 동안만 사는 지역 상태를 한 곳에 모은다: 조회(load) · 입력 초안(draft) · 저장 중(isSaving) ·
 * 저장 실패 문구(saveError) · 버림 확인(isAskingDiscard). 채팅 리듀서는 건드리지 않는다 — 마운트 = 조회, 언마운트 = 폐기라
 * "시트를 열 때마다 재조회"가 구조로 보장된다(캐시 없음).
 * 판정(초과 · 변경 · 저장 가능)은 ui/src/state/memory.ts 순수 함수가 한다 — 전이 규칙을 여기에 다시 쓰지 않는다. 요청은 @/api 래퍼만 부른다.
 * 인증 3종·NOT_FOUND 는 시트를 닫고 화면 공통 처리(onLeave)로 넘긴다. 그 밖의 실패는 시트 안 문구로 보인다(D-37).
 * 언마운트 뒤에 도착한 응답은 버린다(isAlive). 토큰은 다루지 않는다 — 래퍼가 헤더를 붙인다(R-NFR-004).
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { type ApiError, getMemory, isAuthFailure, putMemory } from '@/api'
import { type MemoryLoad, canSaveMemory, isMemoryDirty, isMemoryOver } from '@/state/memory'
import type { MemorySheetProps } from './components/MemorySheet'
import { writeErrorText } from './labels'

export type UseMemorySheetResult = {
  load: MemoryLoad
  draft: string
  setDraft: (value: string) => void
  isSaving: boolean
  /** isMemoryOver(draft) */
  isOver: boolean
  /** canSaveMemory(load, draft, isSaving) */
  canSave: boolean
  /** 저장 실패 문구(시트 안 role=alert). 재저장을 시작하면 비운다 */
  saveError: string | null
  isAskingDiscard: boolean
  retryLoad: () => void
  save: () => void
  requestClose: () => void
  keepEditing: () => void
  confirmDiscard: () => void
}

/** 진행 중인 요청이 보는 두 가지: 지금 마운트 중인가 · 최신 콜백(useRoomActions 선례) */
type Lifecycle = {
  isAlive: () => boolean
  latest: () => MemorySheetProps
}

const LOADING: MemoryLoad = { phase: 'loading' }

/** 인증 3종·NOT_FOUND·ROOM_LOCKED(S6, F-CH-73): 시트가 할 일이 없다 — 시트를 닫고 화면 공통 처리로 넘긴다(F-CH-60) */
const isLeaveError = (error: ApiError): boolean =>
  isAuthFailure(error) || error.code === 'NOT_FOUND' || error.code === 'ROOM_LOCKED'

const useLifecycle = (props: MemorySheetProps): Lifecycle => {
  const aliveRef = useRef(false)
  const latestRef = useRef(props)
  useLayoutEffect(() => {
    latestRef.current = props
  })
  useLayoutEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])
  const isAlive = useCallback((): boolean => aliveRef.current, [])
  const latest = useCallback((): MemorySheetProps => latestRef.current, [])
  return { isAlive, latest }
}

/**
 * F-CH-56: 마운트 때 한 번 조회하고, 조회 실패의 「다시 시도」로 다시 조회한다. 성공하면 초안을 서버 요약으로 채운다.
 * 조회 시도 횟수(attempt)가 effect 의 의존값이다 — 「다시 시도」는 단계를 loading 으로 되돌리고 횟수를 올려 effect 를 다시 돌린다
 */
const useMemoryLoad = (roomId: string, setDraft: (value: string) => void, life: Lifecycle) => {
  const [load, setLoad] = useState<MemoryLoad>(LOADING)
  const [attempt, setAttempt] = useState(0)
  const { isAlive, latest } = life

  useLayoutEffect(() => {
    void getMemory(roomId).then(result => {
      if (!isAlive()) return
      if (result.ok) {
        setLoad({ phase: 'ready', base: result.value })
        setDraft(result.value.summary)
      } else if (isLeaveError(result.error)) {
        latest().onLeave(result.error)
      } else {
        setLoad({ phase: 'error', error: result.error })
      }
    })
  }, [roomId, attempt, setDraft, isAlive, latest])

  const retryLoad = useCallback((): void => {
    setLoad(LOADING)
    setAttempt(count => count + 1)
  }, [])
  return { load, retryLoad }
}

type SaveOptions = { roomId: string; load: MemoryLoad; draft: string; life: Lifecycle }

/**
 * F-CH-57: 「저장」. 초안 원문을 그대로 보낸다(화면은 trim 하지 않는다 — 서버가 정규화한다).
 * 성공이면 onSaved 로 시트를 닫으므로 응답 summary 로 입력을 다시 맞출 일이 없다(D-36). 실패해도 draft 는 그대로 둔다
 */
const useMemorySave = ({ roomId, load, draft, life }: SaveOptions) => {
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 같은 틱 중복 제출 방지(렌더 사이에서도 최신)
  const savingRef = useRef(false)
  const { isAlive, latest } = life

  const saveMemory = useCallback(async (): Promise<void> => {
    const result = await putMemory(roomId, { summary: draft })
    if (!isAlive()) return
    savingRef.current = false
    setIsSaving(false)
    if (result.ok) latest().onSaved()
    else if (isLeaveError(result.error)) latest().onLeave(result.error)
    else setSaveError(writeErrorText(result.error, 'memory'))
  }, [roomId, draft, isAlive, latest])

  const save = useCallback((): void => {
    if (savingRef.current || !canSaveMemory(load, draft, isSaving)) return
    savingRef.current = true
    setIsSaving(true)
    setSaveError(null)
    void saveMemory()
  }, [load, draft, isSaving, saveMemory])
  return { isSaving, saveError, save }
}

type CloseOptions = { load: MemoryLoad; draft: string; isSaving: boolean; life: Lifecycle }

/**
 * F-CH-58 · F-CH-59: 닫기 · 취소 · Esc · 덮개는 requestClose 하나로 모인다. 저장 중이면 무시하고,
 * 변경이 있으면 버림 확인을 띄운다(조회 중·조회 실패는 변경이 없어 바로 닫힌다). 확인 중에도 초안은 그대로다(D-34)
 */
const useMemoryClose = ({ load, draft, isSaving, life }: CloseOptions) => {
  const [isAskingDiscard, setIsAskingDiscard] = useState(false)
  const { latest } = life
  const requestClose = useCallback((): void => {
    if (isSaving) return
    if (isMemoryDirty(load, draft)) {
      setIsAskingDiscard(true)
      return
    }
    latest().onClose()
  }, [isSaving, load, draft, latest])
  const keepEditing = useCallback((): void => setIsAskingDiscard(false), [])
  const confirmDiscard = useCallback((): void => latest().onClose(), [latest])
  return { isAskingDiscard, requestClose, keepEditing, confirmDiscard }
}

export const useMemorySheet = (props: MemorySheetProps): UseMemorySheetResult => {
  const { roomId } = props
  const life = useLifecycle(props)
  const [draft, setDraft] = useState('')
  const { load, retryLoad } = useMemoryLoad(roomId, setDraft, life)
  const { isSaving, saveError, save } = useMemorySave({ roomId, load, draft, life })
  const closing = useMemoryClose({ load, draft, isSaving, life })

  return {
    load,
    draft,
    setDraft,
    isSaving,
    isOver: isMemoryOver(draft),
    canSave: canSaveMemory(load, draft, isSaving),
    saveError,
    retryLoad,
    save,
    ...closing,
  }
}
