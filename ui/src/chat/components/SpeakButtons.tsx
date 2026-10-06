/**
 * SpeakButtons(C 1행 왼쪽 캐릭터 버튼 2) — 설계 chat/design/components.md §2.11 · functions.md F-CH-38 · 요구 R-CHAT-004 · R-CHAT-005 · R-CHAT-013
 * 순서: 세바스찬 → 시엘. 보이는 글자는 CHARACTERS[c].shortName, 접근 이름은 "{이름} 대사 생성". 문구 단일 소스는 labels · CHARACTERS.
 * 눌린 버튼만 다르게 보이게 하지 않는다(진행 표시는 임시 말풍선 하나).
 * 포커스 복귀(F-CH-38): 잠금이 풀리는 순간 포커스가 body 로 빠져 있으면 마지막으로 생성한 캐릭터 버튼으로 돌린다.
 * 다른 곳(입력창 등)으로 옮겼으면 건드리지 않고, 잠금이 풀릴 때마다 기억을 비운다.
 */
import { useEffect, useRef } from 'react'
import { CHARACTERS } from '@shared/characters'
import type { CharacterId } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { labels } from '@/chat/labels'
import styles from './SpeakButtons.module.css'

export type SpeakButtonsProps = {
  /** !canSpeak(state) */
  isDisabled: boolean
  /** 진행 중 speak 의 캐릭터(버튼·「재시도」 어느 쪽으로 시작했든) */
  speakingCharacter: CharacterId | null
  onSpeak: (character: CharacterId) => void
}

const SPEAK_ORDER: readonly CharacterId[] = ['sebastian', 'ciel']

/** 잠금 해제 때 포커스를 잃은 상태였는지(body 또는 없음) */
const hasLostFocus = (): boolean =>
  document.activeElement === null || document.activeElement === document.body

export const SpeakButtons = ({ isDisabled, speakingCharacter, onSpeak }: SpeakButtonsProps) => {
  const sebastianRef = useRef<HTMLButtonElement>(null)
  const cielRef = useRef<HTMLButtonElement>(null)
  const lastSpeakerRef = useRef<CharacterId | null>(null)
  const wasDisabledRef = useRef(isDisabled)

  // 렌더마다 마지막 생성 캐릭터를 기억한다(아래 해제 effect 보다 먼저 선언)
  useEffect(() => {
    if (speakingCharacter !== null) lastSpeakerRef.current = speakingCharacter
  })

  // F-CH-38: 잠금이 풀리는 순간(true → false)에만
  useEffect(() => {
    const wasDisabled = wasDisabledRef.current
    wasDisabledRef.current = isDisabled
    if (isDisabled || !wasDisabled) return
    const last = lastSpeakerRef.current
    if (last !== null && hasLostFocus()) {
      const target = last === 'sebastian' ? sebastianRef : cielRef
      target.current?.focus()
    }
    lastSpeakerRef.current = null
  }, [isDisabled])

  const refs = { sebastian: sebastianRef, ciel: cielRef }
  return (
    <div className={styles.speakButtons}>
      {SPEAK_ORDER.map(character => (
        <Button
          key={character}
          variant="secondary"
          size="md"
          ariaLabel={labels.speakAriaLabel(CHARACTERS[character].shortName)}
          isDisabled={isDisabled}
          buttonRef={refs[character]}
          onClick={() => onSpeak(character)}
        >
          {CHARACTERS[character].shortName}
        </Button>
      ))}
    </div>
  )
}
