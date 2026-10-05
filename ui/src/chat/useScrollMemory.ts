/**
 * useScrollMemory — 설계 chat/design/functions.md F-CH-09 · 요구 R-CHAT-010 · R-NFR-004
 * 스크롤 거리(맨 아래로부터 px)를 pagehide 와 언마운트(‹ 뒤로 · 방 전환) 때 저장한다.
 * 한 번도 배치되지 않았으면(로딩·오류·빈 방) 저장하지 않아 이전에 저장된 값이 그대로 남는다.
 */
import { useEffect } from 'react'
import { saveScrollOffset } from '@/components/utils/storage'

export const useScrollMemory = (
  roomId: string,
  getDistanceFromBottom: () => number | null,
): void => {
  useEffect(() => {
    const save = () => {
      const distance = getDistanceFromBottom()
      if (distance !== null) saveScrollOffset(roomId, distance)
    }
    window.addEventListener('pagehide', save)
    return () => {
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [roomId, getDistanceFromBottom])
}
