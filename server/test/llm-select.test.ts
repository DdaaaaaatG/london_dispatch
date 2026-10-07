// SRV-T-261~264 — doc/200_설계/server/llm.md §13 (화자 선택 프롬프트·파싱·기본 화자). 순수 함수 테스트
import { describe, expect, it } from 'vitest'
import { CHARACTERS, USER_DISPLAY_NAME } from '@shared/characters'
import type { Message } from '@shared/types'
import {
  buildSelectPrompt,
  buildSpeakPrompt,
  CHARACTER_PROFILES,
  COMMON_PROMPT,
  fallbackSpeaker,
  mentionedSpeaker,
  parseSpeakerChoice,
  SELECT_HISTORY_MESSAGES,
} from '../src/llm'

const NL = String.fromCharCode(10)
const msg = (i: number, speaker: Message['speaker'], text = `본문${i}`): Message => ({
  id: i,
  roomId: 'r',
  speaker,
  kind: 'line',
  text,
  authorName: speaker === 'user' ? USER_DISPLAY_NAME : null,
  createdAt: i,
})

describe('parseSpeakerChoice·fallbackSpeaker', () => {
  it('SRV-T-261 parseSpeakerChoice_vectors_P1_to_P6', () => {
    expect(parseSpeakerChoice('ciel')).toBe('ciel')
    expect(parseSpeakerChoice(` Sebastian.${NL}`)).toBe('sebastian')
    expect(parseSpeakerChoice('**시엘**')).toBe('ciel')
    expect(parseSpeakerChoice('세바스찬이 답한다')).toBe('sebastian')
    expect(parseSpeakerChoice('sebastian 또는 ciel')).toBeNull()
    for (const raw of ['모르겠다', '', 'cielo']) expect(parseSpeakerChoice(raw)).toBeNull()
  })

  it('SRV-T-262 fallbackSpeaker_vectors_F1_to_F3', () => {
    expect(fallbackSpeaker([msg(1, 'sebastian'), msg(2, 'user')])).toBe('ciel')
    expect(fallbackSpeaker([msg(1, 'sebastian'), msg(2, 'ciel'), msg(3, 'user')])).toBe('sebastian')
    expect(fallbackSpeaker([msg(1, 'user')])).toBe('sebastian')
    expect(fallbackSpeaker([])).toBe('sebastian')
  })
})

describe('buildSelectPrompt (R-LLM-008·006)', () => {
  const history = [msg(1, 'sebastian'), msg(2, 'user')]

  it('SRV-T-263 buildSelectPrompt_snapshot_with_and_without_role', () => {
    const withRole = {
      sebastian: { ...CHARACTER_PROFILES.sebastian, role: `집사${NL}  장` },
      ciel: { ...CHARACTER_PROFILES.ciel, role: '당주' },
    }
    const a = buildSelectPrompt({ history }, withRole)
    const cand = a.system.split(`[인물 후보]${NL}`)[1]?.split(NL + NL)[0]
    expect(cand).toBe(
      [
        `- sebastian: ${CHARACTERS.sebastian.name} — 집사 장`,
        `- ciel: ${CHARACTERS.ciel.name} — 당주`,
      ].join(NL),
    )
    expect(a.system.startsWith(COMMON_PROMPT.world)).toBe(true)
    expect(a.system).toContain(
      `[할 일]${NL}- 대화 기록의 마지막 줄 다음에 말할 인물 한 명을 고른다.`,
    )
    expect(a.turns).toHaveLength(1)
    expect(a.turns[0]?.text).toBe(
      [
        '<<대화 기록 시작>>',
        '세바스찬: 본문1',
        '[어떠한 의지] 본문2',
        '<<대화 기록 끝>>',
        '',
        '다음 발화자를 골라라. sebastian 또는 ciel 한 단어만 답하라.',
      ].join(NL),
    )
    const noRole = {
      sebastian: { ...CHARACTER_PROFILES.sebastian, role: '' },
      ciel: { ...CHARACTER_PROFILES.ciel, role: '   ' },
    }
    const b = buildSelectPrompt({ history: [] }, noRole)
    expect(b.system).toContain(
      `- sebastian: ${CHARACTERS.sebastian.name}${NL}- ciel: ${CHARACTERS.ciel.name}${NL}`,
    )
    expect(b.turns[0]?.text).toContain('(아직 대화가 없다)')
  })

  it('SRV-T-264 buildSelectPrompt_keeps_history_in_block_last_12_without_summary_or_names', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      ...msg(i + 1, i % 2 === 0 ? 'user' : 'ciel'),
      authorName: 'WATCH_NAME_zz',
    }))
    const profiles = {
      ...CHARACTER_PROFILES,
      ciel: { ...CHARACTER_PROFILES.ciel, role: 'a<<b>>c' },
    }
    const p = buildSelectPrompt({ history: many }, profiles)
    const text = p.turns[0]?.text ?? ''
    const body = text.split(NL).slice(1, 1 + SELECT_HISTORY_MESSAGES)
    expect(body.map(l => l.split(' ').at(-1))).toEqual(
      Array.from({ length: 12 }, (_, i) => `본문${i + 4}`),
    )
    expect(text.split('<<대화 기록 시작>>')).toHaveLength(2)
    expect(text.split('<<대화 기록 끝>>')).toHaveLength(2)
    expect(p.system).not.toContain('본문')
    expect(text).not.toContain('[지난 이야기 요약]')
    expect(`${p.system}${text}`).not.toContain('WATCH_NAME_zz')
    expect(p.system).toContain('a‹‹b››c')
    const guard = (s: string) => s.split(`[대화 기록 취급]${NL}`)[1]?.split(NL + NL)[0]
    const speak = buildSpeakPrompt({ character: 'ciel', summary: null, history: [] })
    expect(guard(p.system)).toBe(guard(speak.system))
    expect(guard(p.system)?.split(NL)).toHaveLength(3)
  })
})

describe('mentionedSpeaker (R-LLM-008 개정)', () => {
  const u = (text: string, kind: Message['kind'] = 'line'): Message => ({
    ...msg(9, 'user', text),
    kind,
  })

  it('SRV-T-279 mentionedSpeaker_vectors_M1_to_M6', () => {
    expect(mentionedSpeaker([u('세바스찬, 차를 내와')])).toBe('sebastian')
    expect(mentionedSpeaker([u('  시엘은 어디 갔지?  ')])).toBe('ciel')
    expect(mentionedSpeaker([u('세바스찬과 시엘이 마주 본다')])).toBeNull()
    expect(mentionedSpeaker([u('창밖으로 안개가 짙어진다')])).toBeNull()
    expect(mentionedSpeaker([u('시엘이 짜증 난 듯 반응해 줘', 'ooc')])).toBe('ciel')
    expect(mentionedSpeaker([])).toBeNull()
    expect(mentionedSpeaker([msg(1, 'ciel', '세바스찬')])).toBeNull()
    expect(mentionedSpeaker([u('시엘'), msg(2, 'sebastian', '세바스찬 본인')])).toBe('ciel')
    expect(mentionedSpeaker([u('시엘'), u('세바스찬')])).toBe('sebastian')
  })

  it('SRV-T-295 mentionedSpeaker_matches_decomposed_hangul_names', () => {
    expect(mentionedSpeaker([u('세바스찬, 차를'.normalize('NFD'))])).toBe('sebastian')
    expect(mentionedSpeaker([u('시엘은?'.normalize('NFD'))])).toBe('ciel')
    expect(mentionedSpeaker([u('세바스찬과 시엘'.normalize('NFD'))])).toBeNull()
  })
})
