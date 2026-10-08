/**
 * S3f 「공통」 탭 AI 모델 선택(ModelChoice) 화면 스펙 초안
 * TC-ST-042 · 043 · 044 · 045 · 046 · 047(화면) · 048 · 049 · 050(화면) · 052
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 design.md §2.3 · §7 · §11 D-ST-12~15 · components.md §3.11 · a11y.md
 * - api 래퍼는 vi.mock('@/api/settings'). 저장 단언은 saveCharacterSettings 호출 인자(둘째 인자 'flash' | undefined).
 *   본문 JSON 에 model 키가 없는지는 ui/src/api 테스트(contract) 몫이다(design.md §7 끝). fetch 모킹 금지.
 * - 구현 전 작성(Red 정상). 비동기는 deferred + findBy*·waitFor. 실제 sleep 없음.
 * - 방향키 이동·실기기 44px·미선택 판 실브라우저 Tab 정지는 수동(TC-ST-053, manual-checklist MC-ST-07·08).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterSettings, CharacterSettingsResponse, LlmModelKey } from '@shared/types'
import { LLM_MODEL_KEYS } from '@shared/settings'
import type { Result } from '@/api'
import { getCharacterSettings, saveCharacterSettings } from '@/api/settings'
import { SettingsScreen } from '@/settings'
import {
  BASE_SETTINGS,
  DEFAULT_RESPONSE,
  FLASH_RESPONSE,
  SAVED_RESPONSE,
  STATUS_SAVED,
  T,
  UNSET_RESPONSE,
  deferred,
  fail,
  ok,
  selfFile,
} from './fixtures'

vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))

const mockedGet = vi.mocked(getCharacterSettings)
const mockedSave = vi.mocked(saveCharacterSettings)

const SAVED_AT_2 = new Date(2026, 9, 6, 15, 30).getTime()
const STATUS_V4 = 'v4 저장됨 10.06 15:30'
const WORLD_EDITED: CharacterSettings = { world: '고친 세계', characters: BASE_SETTINGS.characters }
const MODEL_TEXT = /model|"pro"|"flash"/

const saved = (settings: CharacterSettings, version: number, model: LlmModelKey | null): CharacterSettingsResponse => ({
  settings,
  version,
  updatedAt: SAVED_AT_2,
  isDefault: false,
  model,
})

const renderReady = async (initial: CharacterSettingsResponse = SAVED_RESPONSE) => {
  mockedGet.mockResolvedValueOnce(ok(initial))
  const onLeave = vi.fn()
  const onAuthFailure = vi.fn()
  const onOwnerLost = vi.fn()
  render(<SettingsScreen onLeave={onLeave} onAuthFailure={onAuthFailure} onOwnerLost={onOwnerLost} />)
  await screen.findByRole('tablist', { name: T.tabList })
  return { onLeave, onAuthFailure, onOwnerLost, user: userEvent.setup() }
}
type User = ReturnType<typeof userEvent.setup>

const group = () => screen.getByRole('group', { name: T.modelLegend })
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement
const pro = () => radio(T.modelPro)
const flash = () => radio(T.modelFlash)
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const world = () => screen.getByRole('textbox', { name: '세계관, 필수' }) as HTMLTextAreaElement
const editWorld = (value: string) => fireEvent.change(world(), { target: { value } })
const statusLine = () => screen.getByRole('status')
const worldTab = () => screen.getByRole('tab', { name: T.tabWorld })
/** aria-describedby 가 가리키는 원소들의 글자 */
const describedText = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
const expectChecked = (isPro: boolean, isFlash: boolean) => {
  expect(pro().checked).toBe(isPro)
  expect(flash().checked).toBe(isFlash)
}
const expectSavedWith = (call: number, settings: CharacterSettings, model: LlmModelKey | undefined) => {
  expect(mockedSave.mock.calls[call]?.[0]).toEqual(settings)
  expect(mockedSave.mock.calls[call]?.[1]).toBe(model)
}
const saveAndWait = async (user: User, response: CharacterSettingsResponse) => {
  mockedSave.mockResolvedValueOnce(ok(response))
  await user.click(button(T.save))
  await waitFor(() => expect(button(T.save).disabled).toBe(true))
  await screen.findByRole('alert')
}
const openExportText = async (user: User) => {
  await user.click(button(T.fileMenu))
  const menu = screen.getByRole('dialog', { name: T.fileMenuTitle })
  await user.click(within(menu).getByRole('button', { name: T.exportItem }))
  const dialog = screen.getByRole('dialog', { name: T.exportTitle })
  return { dialog, text: (within(dialog).getByRole('textbox', { name: T.exportText }) as HTMLTextAreaElement).value }
}
const enterStale = async (user: User) => {
  mockedSave.mockResolvedValueOnce(fail('TOKEN_INVALID'))
  await user.click(button(T.save))
  await waitFor(() => expect(statusLine().textContent).toBe(T.statusStale))
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedSave.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TC-ST-042 세 판 렌더 (R-SET-013 · R-SET-004 · R-SET-009)', () => {
  it.each<[string, CharacterSettingsResponse, boolean, boolean, string]>([
    ['pro', SAVED_RESPONSE, true, false, T.modelNoteSelected],
    ['flash', FLASH_RESPONSE, false, true, T.modelNoteSelected],
    ['null', UNSET_RESPONSE, false, false, T.modelNoteUnset],
  ])('TC-ST-042: model %s → 라디오 선택 상태·안내 문구·D clean·묶음이 세계관보다 앞', async (_, response, isPro, isFlash, note) => {
    await renderReady(response)
    const g = group()
    const radios = within(g).getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toEqual([pro(), flash()])
    expect(radios.map(r => r.value)).toEqual([...LLM_MODEL_KEYS])
    expectChecked(isPro, isFlash)
    expect(describedText(g)).toBe(note)
    expect(describedText(pro())).toBe(T.modelProDesc)
    expect(describedText(flash())).toBe(T.modelFlashDesc)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
    expect(g.compareDocumentPosition(world()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/gemini/i)
    expect(localStorage.length).toBe(0)
    await act(async () => {})
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-042: 세바스찬·시엘 탭에는 모델 묶음·라디오가 DOM 에 없다', async () => {
    const { user } = await renderReady()
    for (const name of [T.tabSeb, T.tabCiel]) {
      await user.click(screen.getByRole('tab', { name }))
      expect(screen.queryByRole('group', { name: T.modelLegend })).toBeNull()
      expect(screen.queryAllByRole('radio')).toHaveLength(0)
    }
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('TC-ST-043 · 044 · 048 저장 인자 (R-SET-013 · R-SET-005)', () => {
  it("TC-ST-043: pro 판 → Flash → dirty·되돌리기·저장 활성 → 저장 (settings, 'flash') → v4 저장됨·Flash·토스트 success", async () => {
    const { user, onAuthFailure } = await renderReady()
    await user.click(flash())
    expectChecked(false, true)
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(statusLine().classList.contains('warning')).toBe(true)
    expect(button(T.revert).disabled).toBe(false)
    expect(button(T.save).disabled).toBe(false)
    expect(describedText(group())).toBe(T.modelNoteSelected)

    await saveAndWait(user, saved(BASE_SETTINGS, 4, 'flash'))
    const toast = screen.getByRole('alert')
    expect(toast.textContent).toBe(T.saved)
    expect(toast.classList.contains('success')).toBe(true)
    expect(statusLine().textContent).toBe(STATUS_V4)
    expectChecked(false, true)
    expect(button(T.revert).disabled).toBe(true)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    expectSavedWith(0, BASE_SETTINGS, 'flash')
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('TC-ST-044: (a) 모델 그대로 · 세계관만 고쳐 저장 → 둘째 인자 undefined', async () => {
    const { user } = await renderReady()
    editWorld('고친 세계')
    await saveAndWait(user, saved(WORLD_EDITED, 4, 'pro'))
    expect(mockedSave).toHaveBeenCalledTimes(1)
    expectSavedWith(0, WORLD_EDITED, undefined)
  })

  it('TC-ST-044: (b) null 판에서 본체만 저장 → 둘째 인자 undefined · 저장 뒤에도 미선택 판', async () => {
    const { user } = await renderReady(UNSET_RESPONSE)
    editWorld('고친 세계')
    await saveAndWait(user, saved(WORLD_EDITED, 4, null))
    expectSavedWith(0, WORLD_EDITED, undefined)
    expectChecked(false, false)
    expect(describedText(group())).toBe(T.modelNoteUnset)
  })

  it("TC-ST-044: (c) 모델·본체 둘 다 → 둘째 인자 = 고른 키 'flash' · (d) Flash → Pro(기준값과 같음) + 본체 → undefined", async () => {
    const { user } = await renderReady()
    await user.click(flash())
    editWorld('고친 세계')
    await saveAndWait(user, saved(WORLD_EDITED, 4, 'flash'))
    expectSavedWith(0, WORLD_EDITED, 'flash')
    cleanup()

    const second = await renderReady()
    await second.user.click(flash())
    await second.user.click(pro())
    editWorld('고친 세계')
    await saveAndWait(second.user, saved(WORLD_EDITED, 4, 'pro'))
    expectSavedWith(1, WORLD_EDITED, undefined)
  })

  it("TC-ST-048: 기본값 판(isDefault·v0·pro) → Flash → 저장 (settings, 'flash') → 응답 v1·isDefault false → D v1 저장됨", async () => {
    const { user } = await renderReady(DEFAULT_RESPONSE)
    expect(statusLine().textContent).toBe(T.statusDefault)
    await user.click(flash())
    expect(statusLine().textContent).toBe(T.statusDirty)
    await saveAndWait(user, saved(BASE_SETTINGS, 1, 'flash'))
    expect(statusLine().textContent).toBe('v1 저장됨 10.06 15:30')
    expectSavedWith(0, BASE_SETTINGS, 'flash')
    expectChecked(false, true)
  })
})

describe('TC-ST-045 · 046 되돌리기·이탈 (R-SET-013 · R-SET-009)', () => {
  it('TC-ST-045: (a) pro → Flash → 되돌리기 → Pro·clean (b) 본체+모델 → 되돌리기 → 둘 다 기준값', async () => {
    const { user } = await renderReady()
    await user.click(flash())
    await user.click(button(T.revert))
    expectChecked(true, false)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(button(T.revert).disabled).toBe(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await user.click(flash())
    editWorld('고친 세계')
    await user.click(button(T.revert))
    expectChecked(true, false)
    expect(world().value).toBe(BASE_SETTINGS.world)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-045: (c) null 판 → Pro(안내 = 선택 판 문구) → 되돌리기 → 둘 다 unchecked·미선택 안내', async () => {
    const { user } = await renderReady(UNSET_RESPONSE)
    await user.click(pro())
    expect(describedText(group())).toBe(T.modelNoteSelected)
    expect(statusLine().textContent).toBe(T.statusDirty)
    await user.click(button(T.revert))
    expectChecked(false, false)
    expect(describedText(group())).toBe(T.modelNoteUnset)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-046: (a) 모델만 바꾸고 ‹ → ④ → 취소 머묾(Flash 유지) → ‹ → 나가기 → onLeave()', async () => {
    const { user, onLeave } = await renderReady()
    await user.click(flash())
    await user.click(button(T.back))
    const dialog = screen.getByRole('alertdialog', { name: T.leaveTitle })
    await user.click(within(dialog).getByRole('button', { name: T.cancel }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expectChecked(false, true)
    expect(onLeave).not.toHaveBeenCalled()

    await user.click(button(T.back))
    await user.click(screen.getByRole('button', { name: T.leaveConfirm }))
    expect(onLeave.mock.calls).toEqual([[]])
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-046: (b) Pro → Flash → Pro(기준값과 같음) → clean → ‹ → onLeave() 즉시, ④ 없음', async () => {
    const { user, onLeave } = await renderReady()
    await user.click(flash())
    await user.click(pro())
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    await user.click(button(T.back))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onLeave.mock.calls).toEqual([[]])
  })
})

describe('TC-ST-047 저장 중·stale 라디오 (R-SET-013 · R-SET-011)', () => {
  it('TC-ST-047: (a) 저장 대기 중 두 라디오 disabled · 응답 뒤 enabled·Flash checked', async () => {
    const { user } = await renderReady()
    const d = deferred<Result<CharacterSettingsResponse>>()
    mockedSave.mockReturnValueOnce(d.promise)
    await user.click(flash())
    await user.click(button(T.save))
    expect(statusLine().textContent).toBe(T.statusSaving)
    expect([pro().disabled, flash().disabled]).toEqual([true, true])
    await act(async () => d.resolve(ok(saved(BASE_SETTINGS, 4, 'flash'))))
    await waitFor(() => expect(statusLine().textContent).toBe(STATUS_V4))
    expect([pro().disabled, flash().disabled]).toEqual([false, false])
    expectChecked(false, true)
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it('TC-ST-047: (b) stale(저장 401) → 라디오 enabled · Pro 고르면 반영 · D 인증 만료 유지 · 저장 disabled', async () => {
    const { user, onAuthFailure } = await renderReady()
    await user.click(flash())
    await enterStale(user)
    expect([pro().disabled, flash().disabled]).toEqual([false, false])
    await user.click(pro())
    expectChecked(true, false)
    expect(statusLine().textContent).toBe(T.statusStale)
    expect(button(T.save).disabled).toBe(true)
    expect(button(T.revert).disabled).toBe(true)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    expectSavedWith(0, BASE_SETTINGS, 'flash')
  })
})

describe('TC-ST-049 · 050 파일 기능과 모델 (R-SET-007 개정 · D-ST-15)', () => {
  it('TC-ST-049: (a) 모델만 dirty → ② 텍스트에 model·"pro"·"flash" 0건 · dirty 안내 없음 (b) 본체도 바꾸면 안내 표시', async () => {
    const { user } = await renderReady()
    await user.click(flash())
    const first = await openExportText(user)
    expect(first.text).not.toMatch(MODEL_TEXT)
    expect((JSON.parse(first.text) as { settings: unknown }).settings).toEqual(BASE_SETTINGS)
    expect(within(first.dialog).queryByText(T.exportDirtyNote)).toBeNull()
    await user.click(within(first.dialog).getByRole('button', { name: T.close }))

    editWorld('고친 세계')
    const second = await openExportText(user)
    expect(second.text).not.toMatch(MODEL_TEXT)
    expect(within(second.dialog).getByText(T.exportDirtyNote)).not.toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-049: (c) 모델만 바꾼 뒤 stale → 내보내기(초안) 텍스트에도 model 0건 · stale 안내', async () => {
    const { user } = await renderReady()
    await user.click(flash())
    await enterStale(user)
    const { dialog, text } = await openExportText(user)
    expect(text).not.toMatch(MODEL_TEXT)
    expect(within(dialog).getByText(T.exportStaleNote)).not.toBeNull()
  })

  it("TC-ST-050: Flash(dirty) → 가져오기(최상위·settings 안 model: 'pro') → 세계관만 반영 · Flash 유지 · 무시 0", async () => {
    const { user } = await renderReady()
    await user.click(flash())
    await user.click(button(T.fileMenu))
    await user.click(within(screen.getByRole('dialog', { name: T.fileMenuTitle })).getByRole('button', { name: T.importItem }))
    const dialog = screen.getByRole('dialog', { name: T.importTitle })
    const content = { ...selfFile({ world: '가져온 세계', model: 'pro' }), model: 'pro' }
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.paste }), { target: { value: JSON.stringify(content) } })
    await user.click(within(dialog).getByRole('button', { name: T.importSubmit }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('가져왔습니다(공통 1). 저장해야 반영됩니다.')
    expect(screen.queryByRole('dialog', { name: T.importTitle })).toBeNull()
    expect(world().value).toBe('가져온 세계')
    expectChecked(false, true)
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('TC-ST-052 접근성·키보드 (R-SET-013 · R-SET-009)', () => {
  it('TC-ST-052: fieldset 이름 = AI 모델 · 설명 = 안내 · 라디오 이름 = Pro·Flash 만(설명 섞이지 않음) · 보이는 이름 aria-hidden', async () => {
    await renderReady()
    expect(group().tagName).toBe('FIELDSET')
    expect(describedText(group())).toBe(T.modelNoteSelected)
    expect(pro().getAttribute('aria-label')).toBe(T.modelPro)
    expect(flash().getAttribute('aria-label')).toBe(T.modelFlash)
    expect(screen.queryByRole('radio', { name: new RegExp(T.modelProDesc) })).toBeNull()
    expect(screen.queryByRole('radio', { name: new RegExp(T.modelFlashDesc) })).toBeNull()
    for (const name of [T.modelPro, T.modelFlash]) {
      expect(within(group()).getByText(name).getAttribute('aria-hidden')).toBe('true')
    }
    expect(pro().getAttribute('aria-checked')).toBeNull()
  })

  it.each<[string, CharacterSettingsResponse, () => HTMLInputElement]>([
    ['pro → Pro', SAVED_RESPONSE, pro],
    ['flash → Flash', FLASH_RESPONSE, flash],
    ['null → 첫 라디오 Pro', UNSET_RESPONSE, pro],
  ])('TC-ST-052: Tab 순서 — 「공통」 탭 → 라디오 정지 1회(%s) → 세계관', async (_, response, stop) => {
    const { user } = await renderReady(response)
    worldTab().focus()
    await user.tab()
    expect(document.activeElement).toBe(stop())
    await user.tab()
    expect(document.activeElement).toBe(world())
  })

  it('TC-ST-052: dirty 판 Tab — 탭 → Flash → 세계관 → 되돌리기 → 저장 · 저장 중에는 라디오를 건너뜀', async () => {
    const { user } = await renderReady()
    await user.click(flash())
    worldTab().focus()
    for (const expected of [flash, world, () => button(T.revert), () => button(T.save)]) {
      await user.tab()
      expect(document.activeElement).toBe(expected())
    }
    mockedSave.mockReturnValueOnce(deferred<Result<CharacterSettingsResponse>>().promise)
    await user.click(button(T.save))
    worldTab().focus()
    await user.tab()
    expect(document.activeElement).toBe(world())
  })
})
