/**
 * 캐릭터 표시 메타 — 단일 소스 doc/200_설계/contract/api.md §5.5 (R-LLM-002, R-CHAT-002)
 * 화면은 speaker → 이름·아바타를 이것으로 그린다. 별도 조회 엔드포인트는 없다 (R-API-001)
 * server/characters/{id}.json 의 name 은 여기 name 과 같아야 한다 (S3 검증)
 * 아바타 파일은 ui/public/img/{id}.png → 배포 경로 /embed/img/{id}.png
 */
import { PATHS } from './endpoints'
import type { CharacterId } from './types'

export type CharacterMeta = {
  id: CharacterId
  /** 전체 표시명 (확정사항 §1). server/characters/{id}.json 의 name 과 같아야 한다 */
  name: string
  /** 짧은 이름. 말풍선 이름표·버튼 등 좁은 자리에 쓴다 (R-LLM-002 개정 2026-10-05) */
  shortName: string
  /** 아바타 이미지 경로(동일 출처 절대 경로) */
  avatar: string
}

export const CHARACTERS: { readonly [K in CharacterId]: CharacterMeta & { readonly id: K } } = {
  sebastian: {
    id: 'sebastian',
    name: '세바스찬 미카엘리스',
    shortName: '세바스찬',
    avatar: `${PATHS.embed}/img/sebastian.png`,
  },
  ciel: {
    id: 'ciel',
    name: '시엘 팬텀하이브',
    shortName: '시엘',
    avatar: `${PATHS.embed}/img/ciel.png`,
  },
}
