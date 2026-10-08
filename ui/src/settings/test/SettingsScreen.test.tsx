/**
 * settings 화면 렌더·탭·필드·로드·열기 실패·되돌리기·이탈 스펙 초안
 * TC-ST-001 · 002 · 003 · 004 · 005 · 006 · 007(화면) · 008 · 009 · 010 · 018 · 019 · 020 · 021(a) · 028(a)(b) · 030 · 031
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 ui/src/settings/design.md §14.1
 * - api 래퍼는 vi.mock('@/api/settings') 로 대체한다(화면이 '@/api' 재노출을 import 해도 같은 mock 이 걸린다).
 *   isAuthFailure 는 실물(@/api/client). fetch 모킹 금지.
 * - 화면은 토큰을 모른다(props 콜백만). 비동기는 deferred + findBy*·waitFor. 실제 sleep 없음.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterSettingsResponse } from '@shared/types'
import { CHARACTER_FIELD_KEYS, CHARACTER_FIELD_SPECS, WORLD_FIELD_SPEC } from '@shared/settings'
import { CHARACTERS } from '@shared/characters'
import { ERROR_MESSAGES } from '@shared/errors'
import type { ApiErrorCode, Result } from '@/api'
import { getCharacterSettings, saveCharacterSettings } from '@/api/settings'
import { writeErrorText } from '@/rooms/labels'
import { SettingsScreen } from '@/settings'
import { BASE_SETTINGS, DEFAULT_RESPONSE, SAVED_RESPONSE, STATUS_SAVED, T, chars, deferred, fail, ok } from './fixtures'

vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))

const mockedGet = vi.mocked(getCharacterSettings)
const mockedSave = vi.mocked(saveCharacterSettings)

const renderSettings = () => {
  const onLeave = vi.fn()
  const onAuthFailure = vi.fn()
  const onOwnerLost = vi.fn()
  const utils = render(<SettingsScreen onLeave={onLeave} onAuthFailure={onAuthFailure} onOwnerLost={onOwnerLost} />)
  return { ...utils, onLeave, onAuthFailure, onOwnerLost }
}

const renderReady = async (response: CharacterSettingsResponse = SAVED_RESPONSE) => {
  mockedGet.mockResolvedValueOnce(ok(response))
  const r = renderSettings()
  await screen.findByRole('tablist', { name: T.tabList })
  return r
}

const flush = async () => {
  await act(async () => {})
}
const statusLine = () => screen.getByRole('status')
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement | HTMLInputElement
const panel = () => screen.getByRole('tabpanel')

beforeEach(() => {
  mockedGet.mockReset()
  mockedSave.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('열기 · 로드 (R-SET-004 · R-SET-009)', () => {
  it('TC-ST-001: 로딩 — status 「설정을 불러오는 중」, tablist·⋯·저장 DOM 없음, ‹ 있음', async () => {
    const d = deferred<Result<CharacterSettingsResponse>>()
    mockedGet.mockReturnValueOnce(d.promise)
    renderSettings()

    expect(screen.getByRole('status').textContent).toContain(T.loading)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('button', { name: T.fileMenu })).toBeNull()
    expect(screen.queryByRole('button', { name: T.save })).toBeNull()
    expect(button(T.back)).not.toBeNull()
    expect(localStorage.length).toBe(0)
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedGet.mock.calls[0]).toEqual([])

    await act(async () => d.resolve(ok(SAVED_RESPONSE)))
    expect(await screen.findByRole('tablist', { name: T.tabList })).not.toBeNull()
  })

  it('TC-ST-001: 응답 전 언마운트 → 늦은 응답 무시(콜백 0회, console.error 0회)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deferred<Result<CharacterSettingsResponse>>()
    mockedGet.mockReturnValueOnce(d.promise)
    const { unmount, onLeave, onAuthFailure, onOwnerLost } = renderSettings()
    unmount()
    await act(async () => d.resolve(fail('OWNER_ONLY')))
    expect(onLeave).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onOwnerLost).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('TC-ST-002: NETWORK → error 판(제목·상세·다시 시도) → 다시 시도 → GET 2회째 → ready', async () => {
    const second = deferred<Result<CharacterSettingsResponse>>()
    mockedGet.mockResolvedValueOnce(fail('NETWORK')).mockReturnValueOnce(second.promise)
    const { onLeave, onAuthFailure, onOwnerLost } = renderSettings()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(T.loadError)
    expect(alert.textContent).toContain(T.network)
    expect(alert.textContent).not.toContain('SERVER-RAW-MESSAGE')
    await userEvent.setup().click(within(alert).getByRole('button', { name: T.retry }))

    expect(screen.getByRole('status').textContent).toContain(T.loading)
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => second.resolve(ok(SAVED_RESPONSE)))
    expect(await screen.findByRole('tablist', { name: T.tabList })).not.toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedGet.mock.calls[1]).toEqual([])
    expect(onLeave).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(onOwnerLost).not.toHaveBeenCalled()
  })

  it.each<[ApiErrorCode, string]>([
    ['INTERNAL', ERROR_MESSAGES.INTERNAL],
    ['CONFIG_INVALID', ERROR_MESSAGES.CONFIG_INVALID],
    ['RATE_LIMITED', ERROR_MESSAGES.RATE_LIMITED],
    ['VALIDATION_ERROR', ERROR_MESSAGES.VALIDATION_ERROR],
  ])('TC-ST-002: 열기 %s → error 판 상세 = ERROR_MESSAGES[code], 서버 원문 없음', async (code, detail) => {
    mockedGet.mockResolvedValueOnce(fail(code))
    const { onLeave } = renderSettings()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(detail)
    expect(alert.textContent).not.toContain('SERVER-RAW-MESSAGE')
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('TC-ST-003: 처음 진입 — GET 1회, 선택 탭 「공통」(v1.3), 세계관 값 = 응답 world, h1 포커스, D = vN 저장됨', async () => {
    await renderReady()
    const worldTab = screen.getByRole('tab', { name: T.tabWorld })
    expect(worldTab.getAttribute('aria-selected')).toBe('true')
    expect(textbox('세계관, 필수').value).toBe(BASE_SETTINGS.world)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: T.screenTitle }))
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
    expect(localStorage.length).toBe(0)
    await flush()
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-021: (a) isDefault true → D 「기본값 사용 중」, 두 버튼 비활성', async () => {
    await renderReady(DEFAULT_RESPONSE)
    expect(statusLine().textContent).toBe(T.statusDefault)
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
  })
})

describe('열기 실패 분기 (R-SET-010 · R-CHAT-011 · R-SET-001)', () => {
  it.each<[ApiErrorCode, string]>([
    ['TOKEN_INVALID', T.authTokenInvalid],
    ['TOKEN_REQUIRED', T.authTokenRequired],
    ['LEVEL_TOO_LOW', T.authLevelTooLow],
  ])('TC-ST-018: 열기 %s → onAuthFailure 1회 → onLeave({ authText, warning })', async (code, message) => {
    mockedGet.mockResolvedValueOnce(fail(code))
    const { onLeave, onAuthFailure, onOwnerLost } = renderSettings()
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(onLeave).toHaveBeenCalledWith({ message, tone: 'warning' })
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
    expect(onAuthFailure.mock.invocationCallOrder[0]).toBeLessThan(onLeave.mock.invocationCallOrder[0] ?? 0)
    expect(onOwnerLost).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-019: 열기 OWNER_ONLY → onOwnerLost → onLeave({ ownerOnly, warning }), onAuthFailure 0회, error 판 없음', async () => {
    mockedGet.mockResolvedValueOnce(fail('OWNER_ONLY'))
    const { onLeave, onAuthFailure, onOwnerLost } = renderSettings()
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(onLeave).toHaveBeenCalledWith({ message: T.ownerOnly, tone: 'warning' })
    expect(onOwnerLost).toHaveBeenCalledTimes(1)
    expect(onOwnerLost.mock.invocationCallOrder[0]).toBeLessThan(onLeave.mock.invocationCallOrder[0] ?? 0)
    expect(onAuthFailure).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('탭 · 필드 (R-SET-009 · R-SET-002)', () => {
  it('TC-ST-004: 세바스찬 말투 수정 → 시엘 → 세바스찬 → 값·dirty 유지, 탭 전환 시 폼 scrollTop = 0', async () => {
    await renderReady()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: T.tabSeb }))
    fireEvent.change(textbox('말투, 필수'), { target: { value: '바뀐 말투' } })

    const section = panel()
    const scrollSet = vi.fn()
    Object.defineProperty(section, 'scrollTop', { configurable: true, get: () => 120, set: scrollSet })
    await user.click(screen.getByRole('tab', { name: T.tabCiel }))
    expect(scrollSet).toHaveBeenCalledWith(0)
    expect(textbox('말투, 필수').value).toBe(BASE_SETTINGS.characters.ciel.speech)
    await user.click(screen.getByRole('tab', { name: T.tabSeb }))

    expect(textbox('말투, 필수').value).toBe('바뀐 말투')
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(button(T.revert).disabled).toBe(false)
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('TC-ST-005: 탭 키보드 — →·← 순환, Home·End, aria-selected·tabIndex 로빙, 패널 aria-labelledby', async () => {
    await renderReady()
    const user = userEvent.setup()
    const tab = (name: string) => screen.getByRole('tab', { name })
    tab(T.tabWorld).focus()
    const expectSelected = (name: string, id: string) => {
      for (const n of [T.tabWorld, T.tabSeb, T.tabCiel]) {
        expect(tab(n).getAttribute('aria-selected')).toBe(String(n === name))
        expect(tab(n).tabIndex).toBe(n === name ? 0 : -1)
        expect(tab(n).getAttribute('aria-controls')).toBe('settings-panel')
      }
      expect(document.activeElement).toBe(tab(name))
      expect(panel().getAttribute('aria-labelledby')).toBe(`settings-tab-${id}`)
      expect(tab(name).id).toBe(`settings-tab-${id}`)
    }
    await user.keyboard('{ArrowRight}')
    expectSelected(T.tabSeb, 'sebastian')
    await user.keyboard('{ArrowRight}')
    expectSelected(T.tabCiel, 'ciel')
    await user.keyboard('{ArrowRight}')
    expectSelected(T.tabWorld, 'world')
    await user.keyboard('{ArrowLeft}')
    expectSelected(T.tabCiel, 'ciel')
    await user.keyboard('{Home}')
    expectSelected(T.tabWorld, 'world')
    await user.keyboard('{End}')
    expectSelected(T.tabCiel, 'ciel')
    expect(panel().id).toBe('settings-panel')
  })

  it('TC-ST-006: 필드 11개 — 순서 = CHARACTER_FIELD_KEYS, 필수 ", 필수", 묶음 소제목 3, outputRules 없음', async () => {
    await renderReady()
    await userEvent.setup().click(screen.getByRole('tab', { name: T.tabSeb }))
    const names = within(panel()).getAllByRole('textbox').map(el => el.getAttribute('aria-label'))
    expect(names).toEqual([
      '원작·장르', '나이', '성별', '신분·직업', '성격·배경, 필수', '성격 태그',
      '외형', '관계 메모', '말투, 필수', '샘플 대사', '규칙·금기',
    ])
    expect(within(panel()).getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      '기본 정보', '인물', '말투·규칙',
    ])
    const stars = Array.from(panel().querySelectorAll('[aria-hidden="true"]')).filter(el => el.textContent === '*')
    expect(stars).toHaveLength(2)
    expect(within(panel()).getByText('샘플 대사 (한 줄에 하나, 최대 10)')).not.toBeNull()
    expect(within(panel()).getByText('규칙·금기 (한 줄에 하나, 최대 20)')).not.toBeNull()
    expect(within(panel()).queryByRole('textbox', { name: /출력|outputRules|GUARD/ })).toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-007: (화면) 목록 [a,b] → 줄 글, \' x \\n\\n y \' 입력 → 줄 카운터 2/10줄', async () => {
    await renderReady()
    await userEvent.setup().click(screen.getByRole('tab', { name: T.tabSeb }))
    expect(textbox('샘플 대사').value).toBe(BASE_SETTINGS.characters.sebastian.sampleDialogue.join('\n'))
    fireEvent.change(textbox('샘플 대사'), { target: { value: ' x \n\n y ' } })
    expect(within(panel()).getByText('2/10줄')).not.toBeNull()
    expect(textbox('샘플 대사').value).toBe(' x \n\n y ')
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-008: 상한 초과 — 말투 801 · 샘플 11줄 · 201자 줄 → 카운터·aria-invalid·안내·탭 !·저장 비활성·D 첫 위반', async () => {
    await renderReady()
    await userEvent.setup().click(screen.getByRole('tab', { name: T.tabSeb }))
    fireEvent.change(textbox('말투, 필수'), { target: { value: chars(801) } })

    const counter = within(panel()).getByText('801/800')
    expect(counter.classList.contains('over')).toBe(true)
    expect(textbox('말투, 필수').getAttribute('aria-invalid')).toBe('true')
    expect(textbox('말투, 필수').value).toBe(chars(801))
    expect(within(panel()).getByText('800자 이하로 줄여 주세요.')).not.toBeNull()
    expect(screen.getByRole('tab', { name: `${T.tabSeb}${T.issueSuffix}` })).not.toBeNull()
    expect(button(T.save).disabled).toBe(true)
    expect(statusLine().textContent).toBe('세바스찬 · 말투는 1~800자여야 합니다.')
    expect(statusLine().classList.contains('danger')).toBe(true)

    fireEvent.change(textbox('말투, 필수'), { target: { value: '정중한 존댓말' } })
    const eleven = Array.from({ length: 11 }, (_, i) => `줄${i + 1}`).join('\n')
    fireEvent.change(textbox('샘플 대사'), { target: { value: eleven } })
    expect(within(panel()).getByText('10줄 이하로 줄여 주세요.')).not.toBeNull()
    expect(within(panel()).getByText('11/10줄')).not.toBeNull()
    expect(statusLine().textContent).toBe('세바스찬 · 샘플 대사는 10개 이하여야 합니다.')

    fireEvent.change(textbox('샘플 대사'), { target: { value: `\n${chars(201)}` } })
    expect(within(panel()).getByText('1번째 줄이 200자를 넘습니다.')).not.toBeNull()
    expect(statusLine().textContent).toBe('세바스찬 · 샘플 대사는 한 줄에 200자 이하여야 합니다.')
    expect(button(T.save).disabled).toBe(true)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-009: 필수 빈 칸 — 세계관 공백만 · 성격·배경 빈 칸 → 「필수 항목입니다.」·D 첫 위반·저장 비활성', async () => {
    await renderReady()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '   ' } })
    expect(within(panel()).getByText(T.required)).not.toBeNull()
    expect(screen.getByRole('tab', { name: `${T.tabWorld}${T.issueSuffix}` })).not.toBeNull()
    expect(statusLine().textContent).toBe('공통 · 세계관은 1~2000자여야 합니다.')
    expect(button(T.save).disabled).toBe(true)

    fireEvent.change(textbox('세계관, 필수'), { target: { value: '런던' } })
    await userEvent.setup().click(screen.getByRole('tab', { name: T.tabSeb }))
    fireEvent.change(textbox('성격·배경, 필수'), { target: { value: '' } })
    expect(within(panel()).getByText(T.required)).not.toBeNull()
    expect(statusLine().textContent).toBe('세바스찬 · 성격·배경은 1~1500자여야 합니다.')
    expect(button(T.save).disabled).toBe(true)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-010: dirty — 수정 → D warning·되돌리기·저장 활성 / 앞뒤 공백만 → dirty 아님', async () => {
    await renderReady()
    await userEvent.setup().click(screen.getByRole('tab', { name: T.tabSeb }))
    fireEvent.change(textbox('말투, 필수'), { target: { value: '바뀐 말투' } })
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(statusLine().classList.contains('warning')).toBe(true)
    expect(button(T.revert).disabled).toBe(false)
    expect(button(T.save).disabled).toBe(false)

    fireEvent.change(textbox('말투, 필수'), { target: { value: `  ${BASE_SETTINGS.characters.sebastian.speech}  ` } })
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(button(T.revert).disabled).toBe(true)
    expect(button(T.save).disabled).toBe(true)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-020: 되돌리기 → 값 = 기준값, dirty 해제, 확인 시트 없음', async () => {
    await renderReady()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '고친 세계' } })
    await userEvent.setup().click(button(T.revert))
    expect(textbox('세계관, 필수').value).toBe(BASE_SETTINGS.world)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('이탈 (R-SET-009)', () => {
  it('TC-ST-028: (a) clean ‹ → onLeave() 즉시 · loading 중 ‹ → onLeave()', async () => {
    const { onLeave } = await renderReady()
    await userEvent.setup().click(button(T.back))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onLeave.mock.calls[0]).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    cleanup()

    mockedGet.mockReturnValueOnce(deferred<Result<CharacterSettingsResponse>>().promise)
    const loading = renderSettings()
    await userEvent.setup().click(button(T.back))
    expect(loading.onLeave.mock.calls).toEqual([[]])
  })

  it('TC-ST-028: (b) dirty ‹ → ④(취소 포커스) → 취소 머묾 · Esc 머묾 · 나가기 → onLeave() · 화면 Esc 무동작', async () => {
    const { onLeave } = await renderReady()
    const user = userEvent.setup()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '고친 세계' } })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onLeave).not.toHaveBeenCalled()

    await user.click(button(T.back))
    const dialog = screen.getByRole('alertdialog', { name: T.leaveTitle })
    expect(dialog.textContent).toContain(T.leaveMessage)
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: T.cancel }))
    await user.click(within(dialog).getByRole('button', { name: T.cancel }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(textbox('세계관, 필수').value).toBe('고친 세계')
    expect(onLeave).not.toHaveBeenCalled()

    await user.click(button(T.back))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onLeave).not.toHaveBeenCalled()

    await user.click(button(T.back))
    await user.click(screen.getByRole('button', { name: T.leaveConfirm }))
    expect(onLeave.mock.calls).toEqual([[]])
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('접근성 · 라벨 단일 소스 (R-SET-009 · R-ROOMS-005)', () => {
  it('TC-ST-030: main 이름·h1·tablist·tabpanel·D aria-live · Tab 순서 ‹ → ⋯ → 「공통」 탭 → 모델 라디오(정지 1회) → 세계관', async () => {
    await renderReady()
    expect(screen.getByRole('main', { name: T.screenTitle })).not.toBeNull()
    const h1 = screen.getByRole('heading', { level: 1, name: T.screenTitle })
    expect(h1.tabIndex).toBe(-1)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(panel().getAttribute('aria-labelledby')).toBe('settings-tab-world')
    expect(statusLine().getAttribute('aria-live')).toBe('polite')

    const user = userEvent.setup()
    button(T.back).focus()
    await user.tab()
    expect(document.activeElement).toBe(button(T.fileMenu))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: T.tabWorld }))
    await user.tab()
    // (v1.3 S3f) SAVED_RESPONSE.model = 'pro' → 선택된 라디오 Pro 에 1회 정지(TC-ST-052)
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: T.modelPro }))
    await user.tab()
    expect(document.activeElement).toBe(textbox('세계관, 필수'))
  })

  it('TC-ST-031: 라벨 단일 소스 — spec label · 세계관 · 탭 이름 = shortName · 인증 3문구 = rooms writeErrorText', async () => {
    await renderReady()
    expect(textbox(`${WORLD_FIELD_SPEC.label}, 필수`)).not.toBeNull()
    expect(WORLD_FIELD_SPEC.label).toBe('세계관')
    expect(screen.getByRole('tab', { name: T.tabWorld })).not.toBeNull()
    expect(screen.getByRole('tab', { name: CHARACTERS.sebastian.shortName })).not.toBeNull()
    expect(screen.getByRole('tab', { name: CHARACTERS.ciel.shortName })).not.toBeNull()
    await userEvent.setup().click(screen.getByRole('tab', { name: CHARACTERS.ciel.shortName }))
    for (const key of CHARACTER_FIELD_KEYS) {
      const spec = CHARACTER_FIELD_SPECS[key]
      const required = spec.kind === 'text' && spec.required
      expect(textbox(required ? `${spec.label}, 필수` : spec.label)).not.toBeNull()
    }
    expect(writeErrorText({ code: 'TOKEN_INVALID', message: '' })).toBe(T.authTokenInvalid)
    expect(writeErrorText({ code: 'TOKEN_REQUIRED', message: '' })).toBe(T.authTokenRequired)
    expect(writeErrorText({ code: 'LEVEL_TOO_LOW', message: '' })).toBe(T.authLevelTooLow)
  })
})
