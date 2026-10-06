/** [계약] api.md §14.2 API-T-043 · [요구] R-LLM-002, R-CHAT-002 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import { CHARACTERS, USER_DISPLAY_NAME } from '../src/characters'
import type { CharacterId, SpeakBody, SpeakTarget } from '../src/types'

describe('API-T-043 characters_meta_matches_contract', () => {
  it('키가 정확히 sebastian·ciel', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual(['ciel', 'sebastian'])
  })

  it('id가 키와 같다', () => {
    expect(CHARACTERS.sebastian.id).toBe('sebastian')
    expect(CHARACTERS.ciel.id).toBe('ciel')
  })

  it('전체 이름과 짧은 이름', () => {
    expect(CHARACTERS.sebastian.name).toBe('세바스찬 미카엘리스')
    expect(CHARACTERS.sebastian.shortName).toBe('세바스찬')
    expect(CHARACTERS.ciel.name).toBe('시엘 팬텀하이브')
    expect(CHARACTERS.ciel.shortName).toBe('시엘')
  })

  it('아바타 경로가 /embed/img/{id}.png', () => {
    for (const meta of Object.values(CHARACTERS)) {
      expect(meta.avatar).toBe(`/embed/img/${meta.id}.png`)
    }
  })
})

describe('API-T-112 user_display_name_is_fixed_constant', () => {
  it('값이 「어떠한 의지」이고 캐릭터 이름과 다르다', () => {
    expect(USER_DISPLAY_NAME).toBe('어떠한 의지')
    for (const meta of Object.values(CHARACTERS)) {
      expect(USER_DISPLAY_NAME).not.toBe(meta.name)
      expect(USER_DISPLAY_NAME).not.toBe(meta.shortName)
    }
  })
})

describe('SpeakTarget 타입 (R-MSG-003 · R-MSG-009)', () => {
  it('CharacterId 에 auto 를 더한 세 값이고 SpeakBody 가 쓴다', () => {
    expectTypeOf<SpeakTarget>().toEqualTypeOf<CharacterId | 'auto'>()
    expectTypeOf<SpeakBody['character']>().toEqualTypeOf<SpeakTarget>()
    const all: SpeakTarget[] = ['sebastian', 'ciel', 'auto']
    expect(all).toHaveLength(3)
  })
})
