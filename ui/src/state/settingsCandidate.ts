/**
 * 설정 파일 가져오기 후보 만들기 — 설계 settings/design/state.md §3 SF-07 ~ SF-10 · 정본 api.md §16.2 · §16.3 · 요구 R-SET-008 · R-NFR-004
 * (settingsFile.ts 의 400줄 한계 때문에 나눴다.) 파일이 준 값을 위치별로 분류(후보 · 무시 · 없음)해 후보만 모으고, 검사 통과 값에서 후보 위치만 patch 로 꺼낸다.
 * 순수 TS. 읽는 키는 화이트리스트뿐이다(SETTINGS.apiKey · DB.chats 등은 접근하지 않는다). 파일 내용·결과를 console 에 남기지 않는다(R-SET-012).
 */
import { CHARACTERS } from '@shared/characters'
import { normalizeText } from '@shared/limits'
import {
  CHARACTER_FIELD_KEYS,
  CHARACTER_FIELD_SPECS,
  SETTINGS_CHARACTER_IDS,
} from '@shared/settings'
import type { ListFieldKey, TextFieldKey } from '@shared/settings'
import type { CharacterId, CharacterSettingFields, CharacterSettings } from '@shared/types'
import { linesToList } from './settings'
import type { SettingsPatch } from './settings'

export type ImportSource = 'self' | 'enosBackup' | 'enosWorld'

/** 파일 값으로 채운 필드 수(world 는 boolean, 캐릭터는 0~11) */
export type ImportApplied = {
  readonly world: boolean
  readonly sebastian: number
  readonly ciel: number
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

/**
 * 위치 하나의 분류 결과(api.md §16.2). 후보 = value 가 있다 · 무시 = value 없음 + ignored 1(값은 있으나 형이 달라 못 씀)
 * · 없음 = value 없음 + ignored 0(키 없음·null·E.No.S 빈 값·출처 없는 필드). 무시 수는 후보 만들기에서만 센다.
 */
type Slot<T> = { readonly value: T | undefined; readonly ignored: number }
const NONE: Slot<never> = { value: undefined, ignored: 0 }
const IGNORED: Slot<never> = { value: undefined, ignored: 1 }
const found = <T>(value: T, ignored = 0): Slot<T> => ({ value, ignored })

type CharacterSlots = {
  readonly texts: ReadonlyArray<readonly [TextFieldKey, Slot<string>]>
  readonly lists: ReadonlyArray<readonly [ListFieldKey, Slot<string[]>]>
}
type CharacterCandidate = {
  readonly text: Partial<Record<TextFieldKey, string>>
  readonly list: Partial<Record<ListFieldKey, string[]>>
}
/** 후보 위치의 값만 든다(settingsFile 이 쓰므로 export) */
export type Candidate = {
  readonly world?: string
  readonly characters: Partial<Record<CharacterId, CharacterCandidate>>
  readonly ignoredCount: number
}

const NO_SLOTS: CharacterSlots = { texts: [], lists: [] }

const isTextKey = (key: keyof CharacterSettingFields): key is TextFieldKey =>
  CHARACTER_FIELD_SPECS[key].kind === 'text'
const isListKey = (key: keyof CharacterSettingFields): key is ListFieldKey =>
  CHARACTER_FIELD_SPECS[key].kind === 'list'
const TEXT_KEYS = CHARACTER_FIELD_KEYS.filter(isTextKey)
const LIST_KEYS = CHARACTER_FIELD_KEYS.filter(isListKey)

const buildCharacter = ({ texts, lists }: CharacterSlots) => ({
  candidate: {
    text: texts.reduce<Partial<Record<TextFieldKey, string>>>(
      (acc, [key, slot]) => (slot.value === undefined ? acc : { ...acc, [key]: slot.value }),
      {},
    ),
    list: lists.reduce<Partial<Record<ListFieldKey, string[]>>>(
      (acc, [key, slot]) => (slot.value === undefined ? acc : { ...acc, [key]: slot.value }),
      {},
    ),
  },
  ignored: [...texts, ...lists].reduce((n, [, slot]) => n + slot.ignored, 0),
})

const countFields = (c: CharacterCandidate | undefined): number =>
  c === undefined ? 0 : Object.keys(c.text).length + Object.keys(c.list).length

/** 분류가 끝난 위치들을 후보로 모은다. 후보가 하나도 없는 캐릭터는 넣지 않는다 */
const assembleCandidate = (
  worldSlot: Slot<string>,
  parts: Readonly<Record<CharacterId, CharacterSlots>>,
): Candidate => {
  const built = SETTINGS_CHARACTER_IDS.map(id => ({ id, ...buildCharacter(parts[id]) }))
  const characters = built.reduce<Candidate['characters']>(
    (acc, b) => (countFields(b.candidate) > 0 ? { ...acc, [b.id]: b.candidate } : acc),
    {},
  )
  return {
    ...(worldSlot.value === undefined ? {} : { world: worldSlot.value }),
    characters,
    ignoredCount: worldSlot.ignored + built.reduce((n, b) => n + b.ignored, 0),
  }
}

// ── 자체 형식(SF-07) ──
const selfText = (raw: unknown): Slot<string> => {
  if (raw === undefined || raw === null) return NONE
  return typeof raw === 'string' ? found(raw) : IGNORED
}

const selfList = (raw: unknown): Slot<string[]> => {
  if (raw === undefined || raw === null) return NONE
  return isStringArray(raw) ? found([...raw]) : IGNORED
}

const selfCharacter = (raw: unknown): CharacterSlots => {
  const item: Record<string, unknown> = isRecord(raw) ? raw : {}
  return {
    texts: TEXT_KEYS.map((key): readonly [TextFieldKey, Slot<string>] => [
      key,
      selfText(item[key]),
    ]),
    lists: LIST_KEYS.map((key): readonly [ListFieldKey, Slot<string[]>] => [
      key,
      selfList(item[key]),
    ]),
  }
}

const candidateFromSelf = (root: Record<string, unknown>): Candidate => {
  const settings: Record<string, unknown> = isRecord(root.settings) ? root.settings : {}
  const characters: Record<string, unknown> = isRecord(settings.characters)
    ? settings.characters
    : {}
  return assembleCandidate(selfText(settings.world), {
    sebastian: selfCharacter(characters.sebastian),
    ciel: selfCharacter(characters.ciel),
  })
}

// ── E.No.S(SF-08 · SF-09) ──
const enosText = (raw: unknown, acceptsNumber = false): Slot<string> => {
  if (raw === undefined || raw === null) return NONE
  if (typeof raw === 'number' && acceptsNumber) return found(String(raw))
  if (typeof raw !== 'string') return IGNORED
  const trimmed = normalizeText(raw)
  return trimmed === '' ? NONE : found(trimmed)
}

const nonEmptyLines = (items: readonly string[]): string[] =>
  items.map(normalizeText).filter(line => line !== '')

const enosTags = (raw: unknown): Slot<string> => {
  if (!Array.isArray(raw)) return enosText(raw)
  if (!isStringArray(raw)) return IGNORED
  const tags = nonEmptyLines(raw)
  return tags.length === 0 ? NONE : found(tags.join(', '))
}

/** 문자열이면 줄 나눔, 문자열 배열이면 항목별 trim. 둘 다 아니면 무시, 쓸 줄이 없으면 없음 */
const enosLines = (raw: unknown): Slot<string[]> => {
  if (raw === undefined || raw === null) return NONE
  if (typeof raw !== 'string' && !isStringArray(raw)) return IGNORED
  const lines = typeof raw === 'string' ? linesToList(raw) : nonEmptyLines(raw)
  return lines.length === 0 ? NONE : found(lines)
}

const APPEARANCE_SOURCES = ['appearance_desc', 'hair_style', 'eyes', 'accessories'] as const

/** 외형 = 출처 4개를 각각 분류해 쓸 수 있는 값만 줄바꿈으로 잇는다. 형이 다른 출처는 하나씩 무시 */
const enosAppearance = (item: Record<string, unknown>): Slot<string> => {
  const slots = APPEARANCE_SOURCES.map(source => enosText(item[source]))
  const parts = slots.flatMap(slot => (slot.value === undefined ? [] : [slot.value]))
  return {
    value: parts.length === 0 ? undefined : parts.join('\n'),
    ignored: slots.reduce((n, slot) => n + slot.ignored, 0),
  }
}

const enosCharacter = (item: Record<string, unknown>): CharacterSlots => ({
  texts: [
    ['sourceMaterial', enosText(item.source_material)],
    ['age', enosText(item.age, true)],
    ['gender', enosText(item.gender)],
    ['role', enosText(item.job)],
    ['personalityTags', enosTags(item.personality_tags)],
    ['appearance', enosAppearance(item)],
    ['speech', enosText(item.voice)],
  ],
  lists: [['sampleDialogue', enosLines(item.sample_dialogue)]],
})

const hasShortName = (item: Record<string, unknown>, id: CharacterId): boolean =>
  typeof item.name === 'string' && item.name.includes(CHARACTERS[id].shortName)

/** name 에 shortName 이 든 첫 항목(같은 이름이 둘이면 앞의 것) */
const findEnosCharacter = (
  world: Record<string, unknown>,
  id: CharacterId,
): Record<string, unknown> | null => {
  const items: unknown[] = Array.isArray(world.characters) ? world.characters : []
  return (
    items.find(
      (item): item is Record<string, unknown> => isRecord(item) && hasShortName(item, id),
    ) ?? null
  )
}

/** SF-08: 백업이면 characters 에 세바스찬·시엘이 든 첫 world, world 단독이면 root 자체. 없으면 null */
const pickEnosWorld = (
  source: 'enosBackup' | 'enosWorld',
  root: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (source === 'enosWorld') return root
  const worlds: unknown[] = isRecord(root.DB) && Array.isArray(root.DB.worlds) ? root.DB.worlds : []
  const hasCharacter = (world: Record<string, unknown>): boolean =>
    SETTINGS_CHARACTER_IDS.some(id => findEnosCharacter(world, id) !== null)
  return worlds.find((w): w is Record<string, unknown> => isRecord(w) && hasCharacter(w)) ?? null
}

const enosSlotsOf = (world: Record<string, unknown>, id: CharacterId): CharacterSlots => {
  const item = findEnosCharacter(world, id)
  return item === null ? NO_SLOTS : enosCharacter(item)
}

const candidateFromEnosWorld = (world: Record<string, unknown>): Candidate =>
  assembleCandidate(enosText(world.description), {
    sebastian: enosSlotsOf(world, 'sebastian'),
    ciel: enosSlotsOf(world, 'ciel'),
  })

export const candidateOf = (
  source: ImportSource,
  root: Record<string, unknown>,
): Candidate | null => {
  if (source === 'self') return candidateFromSelf(root)
  const world = pickEnosWorld(source, root)
  return world === null ? null : candidateFromEnosWorld(world)
}

const charactersPatch = (
  characters: Candidate['characters'],
  pick: (c: CharacterCandidate) => Partial<CharacterSettingFields>,
): SettingsPatch['characters'] =>
  SETTINGS_CHARACTER_IDS.reduce<Partial<Record<CharacterId, Partial<CharacterSettingFields>>>>(
    (acc, id) => {
      const c = characters[id]
      return c === undefined ? acc : { ...acc, [id]: pick(c) }
    },
    {},
  )

/** 후보 값 그대로의 patch(정규화 전) — S-15 검사 입력 */
export const rawPatchOf = (candidate: Candidate): SettingsPatch => ({
  ...(candidate.world === undefined ? {} : { world: candidate.world }),
  characters: charactersPatch(candidate.characters, c => ({ ...c.text, ...c.list })),
})

/** 검사 통과 값에서 후보 키만 꺼낸다(정규화된 값) */
const pickChecked = (
  fields: CharacterSettingFields,
  c: CharacterCandidate,
): Partial<CharacterSettingFields> => ({
  ...TEXT_KEYS.reduce<Partial<Record<TextFieldKey, string>>>(
    (acc, key) => (c.text[key] === undefined ? acc : { ...acc, [key]: fields[key] }),
    {},
  ),
  ...LIST_KEYS.reduce<Partial<Record<ListFieldKey, string[]>>>(
    (acc, key) => (c.list[key] === undefined ? acc : { ...acc, [key]: fields[key] }),
    {},
  ),
})

/**
 * SF-10: 덮어쓰기·검사는 checkPatchedSettings 가 한다. 이 함수는 통과한 value 에서 후보 위치만 patch 로 꺼낸다.
 * 무시 계수는 하지 않는다(후보 만들기에서 센 candidate.ignoredCount 를 그대로 돌려준다).
 */
export const patchFromChecked = (
  value: CharacterSettings,
  candidate: Candidate,
): { patch: SettingsPatch; applied: ImportApplied } => {
  const { characters } = candidate
  const patch: SettingsPatch = {
    ...(candidate.world === undefined ? {} : { world: value.world }),
    characters: SETTINGS_CHARACTER_IDS.reduce<
      Partial<Record<CharacterId, Partial<CharacterSettingFields>>>
    >((acc, id) => {
      const c = characters[id]
      return c === undefined ? acc : { ...acc, [id]: pickChecked(value.characters[id], c) }
    }, {}),
  }
  const applied: ImportApplied = {
    world: candidate.world !== undefined,
    sebastian: countFields(characters.sebastian),
    ciel: countFields(characters.ciel),
  }
  return { patch, applied }
}
