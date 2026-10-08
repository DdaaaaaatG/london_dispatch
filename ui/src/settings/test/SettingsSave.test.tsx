/**
 * settings 저장 흐름 스펙 초안
 * TC-ST-007(저장 본문) · 011 · 012 · 013 · 014 · 015 · 016 · 017 · 021(b) · 028(c) · 040
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 ui/src/settings/design/functions.md F-ST-09·10 · §3.3
 * - api 래퍼는 vi.mock('@/api/settings'). isAuthFailure·toastToneOf 실물. fetch 모킹 금지.
 * - 저장 본문 = precheckDraft(draft).value(정규화 값). 토큰은 화면이 다루지 않는다(onAuthFailure 콜백만).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterSettings, CharacterSettingsResponse, LlmModelKey } from '@shared/types'
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiErrorCode, Result } from '@/api'
import { getCharacterSettings, saveCharacterSettings } from '@/api/settings'
import { SettingsScreen } from '@/settings'
import {
  BASE_SETTINGS,
  DEFAULT_RESPONSE,
  SAVED_RESPONSE,
  T,
  deferred,
  fail,
  ok,
  withCharField,
} from './fixtures'

vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))

const mockedGet = vi.mocked(getCharacterSettings)
const mockedSave = vi.mocked(saveCharacterSettings)

const SAVED_AT_2 = new Date(2026, 9, 6, 15, 30).getTime()
/** (S3f) model 필수. 본체만 저장하는 기존 TC 는 기준값과 같은 'pro' 를 돌려받는다 */
const response = (
  settings: CharacterSettings,
  version: number,
  model: LlmModelKey | null = 'pro',
): CharacterSettingsResponse => ({
  settings,
  version,
  updatedAt: SAVED_AT_2,
  isDefault: false,
  model,
})

/** (S3f) saveCharacterSettings(settings, model?) — 본체만 저장이면 둘째 인자 undefined(TC-ST-044) */
const expectSavedWith = (call: number, settings: CharacterSettings, model: LlmModelKey | undefined) => {
  expect(mockedSave.mock.calls[call]?.[0]).toEqual(settings)
  expect(mockedSave.mock.calls[call]?.[1]).toBe(model)
}

const renderReady = async (initial: CharacterSettingsResponse = SAVED_RESPONSE) => {
  mockedGet.mockResolvedValueOnce(ok(initial))
  const onLeave = vi.fn()
  const onAuthFailure = vi.fn()
  const onOwnerLost = vi.fn()
  render(<SettingsScreen onLeave={onLeave} onAuthFailure={onAuthFailure} onOwnerLost={onOwnerLost} />)
  await screen.findByRole('tablist', { name: T.tabList })
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: T.tabSeb }))
  return { onLeave, onAuthFailure, onOwnerLost, user }
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement | HTMLInputElement
const statusLine = () => screen.getByRole('status')
const h1 = () => screen.getByRole('heading', { level: 1, name: T.screenTitle })
const editSpeech = (value: string) => fireEvent.change(textbox('말투, 필수'), { target: { value } })

beforeEach(() => {
  mockedGet.mockReset()
  mockedSave.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('저장 성공 (R-SET-005 · R-SET-009)', () => {
  it('TC-ST-007: (저장 본문) 목록 \' x \\n\\n y \' → saveCharacterSettings 인자 sampleDialogue [x, y], 나머지 = 기준값', async () => {
    const { user } = await renderReady()
    const expected = withCharField(BASE_SETTINGS, 'sebastian', 'sampleDialogue', ['x', 'y'])
    mockedSave.mockResolvedValueOnce(ok(response(expected, 4)))
    fireEvent.change(textbox('샘플 대사'), { target: { value: ' x \n\n y ' } })
    await user.click(button(T.save))
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1))
    expectSavedWith(0, expected, undefined)
  })

  it('TC-ST-011: 저장 성공 → 1회(정규화 값) → D v4 저장됨 · dirty 해제 · 토스트 success · 초안 = 응답 settings', async () => {
    const { user, onAuthFailure, onLeave } = await renderReady()
    const body = withCharField(BASE_SETTINGS, 'sebastian', 'speech', '새 말투')
    const serverValue = withCharField(BASE_SETTINGS, 'sebastian', 'speech', '새 말투(서버 정규화)')
    mockedSave.mockResolvedValueOnce(ok(response(serverValue, 4)))
    editSpeech('  새 말투  ')
    await user.click(button(T.save))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(T.saved)
    expect(toast.classList.contains('success')).toBe(true)
    expect(statusLine().textContent).toBe('v4 저장됨 10.06 15:30')
    expect(textbox('말투, 필수').value).toBe('새 말투(서버 정규화)')
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    expect(mockedSave).toHaveBeenCalledTimes(1)
    expectSavedWith(0, body, undefined)
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
  })

  it('TC-ST-021: (b) 기본값에서 저장 성공 → D 「v1 저장됨 10.06 15:30」', async () => {
    const { user } = await renderReady(DEFAULT_RESPONSE)
    expect(statusLine().textContent).toBe(T.statusDefault)
    const saved = withCharField(BASE_SETTINGS, 'sebastian', 'speech', '바뀐 말투')
    mockedSave.mockResolvedValueOnce(ok(response(saved, 1)))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    await waitFor(() => expect(statusLine().textContent).toBe('v1 저장됨 10.06 15:30'))
  })

  it('TC-ST-012: 저장 중 — 입력 readOnly · ‹·⋯·되돌리기·저장 disabled · D 저장 중... · 연타 1회', async () => {
    const { user } = await renderReady()
    const d = deferred<Result<CharacterSettingsResponse>>()
    mockedSave.mockReturnValueOnce(d.promise)
    editSpeech('바뀐 말투')
    await user.click(button(T.save))

    expect(statusLine().textContent).toBe(T.statusSaving)
    for (const el of within(screen.getByRole('tabpanel')).getAllByRole('textbox')) {
      expect((el as HTMLTextAreaElement).readOnly).toBe(true)
    }
    expect(button(T.back).disabled).toBe(true)
    expect(button(T.fileMenu).disabled).toBe(true)
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
    await user.click(button(T.save))
    fireEvent.click(button(T.save))
    expect(mockedSave).toHaveBeenCalledTimes(1)

    await act(async () => d.resolve(ok(response(withCharField(BASE_SETTINGS, 'sebastian', 'speech', '바뀐 말투'), 4))))
    expect(statusLine().textContent).toBe('v4 저장됨 10.06 15:30')
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it('TC-ST-012: 리렌더 전 같은 act 안 저장 클릭 2회 → 호출 1회(saveInFlightRef)', async () => {
    await renderReady()
    mockedSave.mockReturnValue(deferred<Result<CharacterSettingsResponse>>().promise)
    editSpeech('바뀐 말투')
    act(() => {
      fireEvent.click(button(T.save))
      fireEvent.click(button(T.save))
    })
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })
})

describe('저장 실패 — 토스트 (R-SET-005 · R-CHAT-011)', () => {
  it('TC-ST-013: 400 VALIDATION_ERROR → 토스트 danger = 서버 message, 탭·초안 유지, 저장 다시 활성', async () => {
    const { user, onAuthFailure } = await renderReady()
    mockedSave.mockResolvedValueOnce(fail('VALIDATION_ERROR', { message: '시엘 · 말투는 1~800자여야 합니다.' }))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('시엘 · 말투는 1~800자여야 합니다.')
    expect(toast.classList.contains('danger')).toBe(true)
    expect(screen.getByRole('tab', { name: T.tabSeb }).getAttribute('aria-selected')).toBe('true')
    expect(textbox('말투, 필수').value).toBe('바뀐 말투')
    expect(button(T.save).disabled).toBe(false)
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it.each<[string, Partial<{ retryAfterSec: number }>, string]>([
    ['retryAfterSec 40', { retryAfterSec: 40 }, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    ['값 없음', {}, ERROR_MESSAGES.RATE_LIMITED],
  ])('TC-ST-014: 429 RATE_LIMITED(%s) → 토스트 warning, onAuthFailure 0회, 초안 유지', async (_label, extra, message) => {
    const { user, onAuthFailure } = await renderReady()
    mockedSave.mockResolvedValueOnce(fail('RATE_LIMITED', extra))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(message)
    expect(toast.classList.contains('warning')).toBe(true)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(textbox('말투, 필수').value).toBe('바뀐 말투')
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it.each<[ApiErrorCode, string]>([
    ['NETWORK', T.network],
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['CONFIG_INVALID', ERROR_MESSAGES.CONFIG_INVALID],
  ])('TC-ST-015: %s → 토스트 danger, 서버 원문 없음, 초안 유지', async (code, message) => {
    const { user, onAuthFailure, onLeave } = await renderReady()
    mockedSave.mockResolvedValueOnce(fail(code))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(message)
    expect(toast.textContent).not.toContain('SERVER-RAW-MESSAGE')
    expect(toast.classList.contains('danger')).toBe(true)
    expect(textbox('말투, 필수').value).toBe('바뀐 말투')
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })
})

describe('저장 실패 — stale · 주인 상실 (R-SET-011 · R-SET-001 · R-SET-010)', () => {
  it.each<ApiErrorCode>(['TOKEN_INVALID', 'LEVEL_TOO_LOW', 'TOKEN_REQUIRED'])(
    'TC-ST-016: 저장 %s → onAuthFailure 1회 · F 안내 alert · D 인증 만료 · 저장·되돌리기 비활성 · 입력 가능 · 가져오기만 비활성 · 토스트 없음',
    async code => {
      const { user, onAuthFailure, onLeave, onOwnerLost } = await renderReady()
      mockedSave.mockResolvedValueOnce(fail(code))
      editSpeech('바뀐 말투')
      await user.click(button(T.save))

      await waitFor(() => expect(onAuthFailure).toHaveBeenCalledTimes(1))
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.textContent).toBe(T.staleNotice)
      expect(statusLine().textContent).toBe(T.statusStale)
      expect(statusLine().classList.contains('danger')).toBe(true)
      expect(button(T.save).disabled).toBe(true)
      expect(button(T.revert).disabled).toBe(true)
      expect(textbox('말투, 필수').value).toBe('바뀐 말투')
      expect(textbox('말투, 필수').readOnly).toBe(false)
      editSpeech('stale 중 추가 입력')
      expect(textbox('말투, 필수').value).toBe('stale 중 추가 입력')
      expect(button(T.save).disabled).toBe(true)

      await user.click(button(T.fileMenu))
      const menu = screen.getByRole('dialog', { name: T.fileMenuTitle })
      expect((within(menu).getByRole('button', { name: T.importItem }) as HTMLButtonElement).disabled).toBe(true)
      expect((within(menu).getByRole('button', { name: T.exportItem }) as HTMLButtonElement).disabled).toBe(false)
      expect(onLeave).not.toHaveBeenCalled()
      expect(onOwnerLost).not.toHaveBeenCalled()
      expect(mockedSave).toHaveBeenCalledTimes(1)
    },
  )

  it('TC-ST-028: (c) stale + dirty 에서 ‹ → ④ 이탈 확인', async () => {
    const { user, onLeave } = await renderReady()
    mockedSave.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    await screen.findByText(T.staleNotice)
    await user.click(button(T.back))
    expect(screen.getByRole('alertdialog', { name: T.leaveTitle })).not.toBeNull()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('TC-ST-017: 저장 OWNER_ONLY → onOwnerLost 1회 → onLeave({ ownerOnly, warning }), onAuthFailure 0회, 토스트 없음', async () => {
    const { user, onAuthFailure, onLeave, onOwnerLost } = await renderReady()
    mockedSave.mockResolvedValueOnce(fail('OWNER_ONLY'))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(onLeave).toHaveBeenCalledWith({ message: T.ownerOnly, tone: 'warning' })
    expect(onOwnerLost).toHaveBeenCalledTimes(1)
    expect(onOwnerLost.mock.invocationCallOrder[0]).toBeLessThan(onLeave.mock.invocationCallOrder[0] ?? 0)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('저장 뒤 포커스 (a11y §2.6)', () => {
  it('TC-ST-040: 성공 → h1 · INTERNAL → 「저장」 · TOKEN_INVALID(stale) → h1', async () => {
    const { user } = await renderReady()
    mockedSave
      .mockResolvedValueOnce(fail('INTERNAL'))
      .mockResolvedValueOnce(ok(response(withCharField(BASE_SETTINGS, 'sebastian', 'speech', '바뀐 말투'), 4)))
      .mockResolvedValueOnce(fail('TOKEN_INVALID'))
    editSpeech('바뀐 말투')
    await user.click(button(T.save))
    await waitFor(() => expect(document.activeElement).toBe(button(T.save)))

    await user.click(button(T.save))
    await waitFor(() => expect(statusLine().textContent).toBe('v4 저장됨 10.06 15:30'))
    expect(document.activeElement).toBe(h1())

    editSpeech('다시 바꿈')
    await user.click(button(T.save))
    await screen.findByText(T.staleNotice)
    expect(document.activeElement).toBe(h1())
    expect(mockedSave).toHaveBeenCalledTimes(3)
  })
})
