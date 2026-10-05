/** [계약] api.md §14.2 API-T-043 · [요구] R-LLM-002, R-CHAT-002 */
import { describe, expect, it } from 'vitest'
import { CHARACTERS } from '../src/characters'

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
