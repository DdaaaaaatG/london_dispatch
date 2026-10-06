/**
 * 설정 파일 내보내기·가져오기 — 설계 settings/design/state.md §3 · 정본 api.md §16 · 요구 R-SET-007 · R-SET-008 · R-NFR-004
 * 비유: 내보내기는 장부에서 정해진 칸만 베껴 쓰는 복사본이고, 가져오기는 남의 장부에서 쓸 만한 칸만 골라 연필 원고에 옮겨 적는 일이다.
 * 순수 TS(DOM·React 없음). 읽는 키는 화이트리스트뿐이고(SETTINGS.apiKey · DB.chats 등은 접근하지 않는다) 파일 내용·결과를 console 에 남기지 않는다(R-SET-012).
 * 파일 읽기(FileReader)와 파일 크기 사전 거부(File.size)는 ImportSheet 몫이다.
 */
import {
  SETTINGS_FILE_FORMAT,
  SETTINGS_FILE_FORMAT_VERSION,
  SETTINGS_IMPORT_MAX_BYTES,
} from '@shared/settings'
import type { CharacterSettingsFile } from '@shared/settings'
import type { CharacterSettingFields, CharacterSettings } from '@shared/types'
import { checkPatchedSettings } from './settings'
import type { SettingsPatch } from './settings'
import { candidateOf, isRecord, patchFromChecked, rawPatchOf } from './settingsCandidate'
import type { ImportApplied, ImportSource } from './settingsCandidate'

export type { ImportApplied, ImportSource }

export type ImportFailureReason =
  | 'tooLarge'
  | 'readFailed'
  | 'notJson'
  | 'unknownFormat'
  | 'unsupportedVersion'
  | 'noMatchingWorld'
  | 'invalid'

export type ImportResult =
  | {
      ok: true
      patch: SettingsPatch
      source: ImportSource
      applied: ImportApplied
      ignoredCount: number
    }
  | { ok: false; reason: Exclude<ImportFailureReason, 'invalid'> }
  /** 후보 검사의 checkCharacterSettings 첫 위반 message 그대로 */
  | { ok: false; reason: 'invalid'; message: string }

export type ImportSuccess = Extract<ImportResult, { ok: true }>
export type ImportFailure = Extract<ImportResult, { ok: false }>

const copyCharacter = (f: CharacterSettingFields): CharacterSettingFields => ({
  sourceMaterial: f.sourceMaterial,
  age: f.age,
  gender: f.gender,
  role: f.role,
  persona: f.persona,
  personalityTags: f.personalityTags,
  appearance: f.appearance,
  relationships: f.relationships,
  speech: f.speech,
  sampleDialogue: [...f.sampleDialogue],
  rules: [...f.rules],
})

/** SF-01: 화이트리스트 사본으로 파일 객체를 만든다(입력을 펼치지 않는다 — 비밀값·메타가 섞여도 나오지 않는다) */
export const toExportFile = (settings: CharacterSettings, now: Date): CharacterSettingsFile => ({
  format: SETTINGS_FILE_FORMAT,
  formatVersion: SETTINGS_FILE_FORMAT_VERSION,
  exportedAt: now.toISOString(),
  settings: {
    world: settings.world,
    characters: {
      sebastian: copyCharacter(settings.characters.sebastian),
      ciel: copyCharacter(settings.characters.ciel),
    },
  },
})

/** SF-02 */
export const serializeExportFile = (file: CharacterSettingsFile): string =>
  JSON.stringify(file, null, 2)

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** SF-03: london-dispatch-characters-YYYYMMDD-HHmm.json, 브라우저 현지 시각 */
export const exportFileName = (now: Date): string => {
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  return `london-dispatch-characters-${date}-${pad2(now.getHours())}${pad2(now.getMinutes())}.json`
}

/** SF-04 */
export const utf8ByteLength = (text: string): number => new TextEncoder().encode(text).length

const parseJsonObject = (text: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** SF-06: api.md §16.2 판별 순서 — 자체 형식(버전 확인) → E.No.S 백업 → E.No.S world 단독 → 모름 */
export const detectImportSource = (
  root: Record<string, unknown>,
): ImportSource | 'unsupportedVersion' | 'unknownFormat' => {
  if (root.format === SETTINGS_FILE_FORMAT) {
    return root.formatVersion === SETTINGS_FILE_FORMAT_VERSION ? 'self' : 'unsupportedVersion'
  }
  if (isRecord(root.DB) && Array.isArray(root.DB.worlds)) return 'enosBackup'
  if (Array.isArray(root.characters) && typeof root.description === 'string') return 'enosWorld'
  return 'unknownFormat'
}

/**
 * SF-05: 가져오기 파일(텍스트) 해석. base = 마지막으로 읽거나 저장한 값(state.base.settings).
 * 순서: 크기 → JSON → 판별 → 후보 만들기 → base 위에 후보만 덮어 checkCharacterSettings → 통과한 후보 위치의 정규화 값만 patch.
 * 위반이면 전체 거부(자르지 않음). 현 초안은 입력으로 받지 않는다(초안 전체 검사는 저장 활성 조건 몫). throw 없음.
 */
export const parseImportFile = (text: string, base: CharacterSettings): ImportResult => {
  if (utf8ByteLength(text) > SETTINGS_IMPORT_MAX_BYTES) return { ok: false, reason: 'tooLarge' }
  const root = parseJsonObject(text)
  if (root === null) return { ok: false, reason: 'notJson' }
  const source = detectImportSource(root)
  if (source === 'unsupportedVersion' || source === 'unknownFormat') {
    return { ok: false, reason: source }
  }
  const candidate = candidateOf(source, root)
  if (candidate === null) return { ok: false, reason: 'noMatchingWorld' }
  const checked = checkPatchedSettings(base, rawPatchOf(candidate))
  if (!checked.ok) return { ok: false, reason: 'invalid', message: checked.issue.message }
  const { patch, applied } = patchFromChecked(checked.value, candidate)
  return { ok: true, patch, source, applied, ignoredCount: candidate.ignoredCount }
}
