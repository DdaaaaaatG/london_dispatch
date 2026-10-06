/** [계약] api.md §14.15 API-T-105·106·107 · [요구] R-SET-002, R-SET-005, R-SET-007, R-SET-008 */
import { describe, expect, it } from 'vitest'
import { CHARACTERS } from '../src/characters'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  SETTINGS_BODY_MAX_BYTES,
  SETTINGS_CHARACTER_IDS,
  SETTINGS_COMMON_SCOPE,
  SETTINGS_FILE_FORMAT,
  SETTINGS_FILE_FORMAT_VERSION,
  SETTINGS_IMPORT_MAX_BYTES,
  WORLD_FIELD_SPEC,
  checkCharacterSettings,
  settingsScopeOf,
} from '../src/settings'
import { SETTINGS_VECTORS, validSettings } from './settings-vectors'

describe('API-T-105 settings_specs_match_contract', () => {
  it('필드 키 11개·중복 없음·스펙 키와 같은 순서', () => {
    expect(CHARACTER_FIELD_KEYS).toHaveLength(11)
    expect(new Set(CHARACTER_FIELD_KEYS).size).toBe(11)
    expect(Object.keys(CHARACTER_FIELD_SPECS)).toEqual([...CHARACTER_FIELD_KEYS])
  })

  it('라벨·상한·필수가 계약 표와 같다', () => {
    expect(CHARACTER_FIELD_SPECS).toEqual({
      sourceMaterial: { kind: 'text', label: '원작·장르', required: false, max: 60 },
      age: { kind: 'text', label: '나이', required: false, max: 40 },
      gender: { kind: 'text', label: '성별', required: false, max: 20 },
      role: { kind: 'text', label: '신분·직업', required: false, max: 80 },
      persona: { kind: 'text', label: '성격·배경', required: true, max: 1500 },
      personalityTags: { kind: 'text', label: '성격 태그', required: false, max: 200 },
      appearance: { kind: 'text', label: '외형', required: false, max: 800 },
      relationships: { kind: 'text', label: '관계 메모', required: false, max: 800 },
      speech: { kind: 'text', label: '말투', required: true, max: 800 },
      sampleDialogue: { kind: 'list', label: '샘플 대사', maxItems: 10, itemMax: 200 },
      rules: { kind: 'list', label: '규칙·금기', maxItems: 20, itemMax: 200 },
    })
    expect(WORLD_FIELD_SPEC).toEqual({ kind: 'text', label: '세계관', required: true, max: 2000 })
  })

  it('캐릭터 id 집합이 CHARACTERS와 같고 순서는 sebastian, ciel', () => {
    expect([...SETTINGS_CHARACTER_IDS]).toEqual(['sebastian', 'ciel'])
    expect([...SETTINGS_CHARACTER_IDS].sort()).toEqual(Object.keys(CHARACTERS).sort())
  })

  it('상수 4개 값', () => {
    expect(SETTINGS_FILE_FORMAT).toBe('london-dispatch/character-settings')
    expect(SETTINGS_FILE_FORMAT_VERSION).toBe(1)
    expect(SETTINGS_BODY_MAX_BYTES).toBe(131072)
    expect(SETTINGS_IMPORT_MAX_BYTES).toBe(5242880)
  })

  it('settingsScopeOf', () => {
    expect(settingsScopeOf()).toBe('공통')
    expect(SETTINGS_COMMON_SCOPE).toBe('공통')
    expect(settingsScopeOf('sebastian')).toBe('세바스찬')
    expect(settingsScopeOf('ciel')).toBe('시엘')
  })
})

describe('API-T-106 check_accepts_boundaries_and_normalizes', () => {
  for (const v of SETTINGS_VECTORS.filter(x => x.expect.ok)) {
    it(v.name, () => {
      expect(checkCharacterSettings(v.input).ok).toBe(true)
    })
  }

  it('값은 trim되고 목록 빈 항목이 제거된다', () => {
    const input = validSettings()
    input.world = '  19세기 말 런던.  '
    input.characters.sebastian.sampleDialogue = ['  분부대로.  ', '', '   ']
    input.characters.ciel.persona = '\n 오만한 소년.\t'
    const r = checkCharacterSettings(input)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.world).toBe('19세기 말 런던.')
    expect(r.value.characters.sebastian.sampleDialogue).toEqual(['분부대로.'])
    expect(r.value.characters.ciel.persona).toBe('오만한 소년.')
  })

  it('입력 객체를 바꾸지 않는다', () => {
    const input = validSettings()
    input.world = '  x  '
    input.characters.ciel.rules = [' a ', '']
    const snapshot: unknown = JSON.parse(JSON.stringify(input))
    checkCharacterSettings(input)
    expect(input).toEqual(snapshot)
  })

  it('반환 값의 키 순서가 고정이다', () => {
    const r = checkCharacterSettings(validSettings())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(Object.keys(r.value)).toEqual(['world', 'characters'])
    expect(Object.keys(r.value.characters)).toEqual(['sebastian', 'ciel'])
    expect(Object.keys(r.value.characters.ciel)).toEqual([...CHARACTER_FIELD_KEYS])
  })
})

describe('API-T-107 check_rejects_with_contract_messages', () => {
  const rejects = SETTINGS_VECTORS.filter(x => !x.expect.ok)

  it('벡터가 문구 표 13행을 모두 덮는다', () => {
    for (let row = 1; row <= 13; row += 1) {
      expect(rejects.some(v => v.name.startsWith(`행${row} `))).toBe(true)
    }
  })

  it('필드 라벨 12개(세계관 + 11)가 벡터 문구에 모두 나온다', () => {
    const labels = ['세계관', ...Object.values(CHARACTER_FIELD_SPECS).map(s => s.label)]
    expect(labels).toHaveLength(12)
    for (const label of labels) {
      expect(rejects.some(v => !v.expect.ok && v.expect.message.includes(` · ${label}`))).toBe(true)
    }
  })

  for (const v of rejects) {
    it(v.name, () => {
      const r = checkCharacterSettings(v.input)
      expect(r.ok).toBe(false)
      if (r.ok || v.expect.ok) return
      expect([...r.issue.path]).toEqual(v.expect.path)
      expect(r.issue.message).toBe(v.expect.message)
    })
  }

  it('문구에 입력한 키 이름·값을 싣지 않는다', () => {
    const input = { ...validSettings(), apiKey: 'SECRET-VALUE' }
    const r = checkCharacterSettings(input)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issue.message).not.toContain('apiKey')
    expect(r.issue.message).not.toContain('SECRET-VALUE')
  })
})
