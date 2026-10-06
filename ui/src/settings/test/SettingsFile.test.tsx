/**
 * settings 내보내기·가져오기 시트 스펙 초안
 * TC-ST-022 · 023 · 024 · 025 · 026 · 027 · 029 · 033(download.ts) · 039 · 041
 * 단일 소스: ui/src/settings/test/scenarios.md · 설계 design/components.md §3.7~§3.10 · functions.md F-ST-12~17 · state.md §3
 * - api 래퍼는 vi.mock('@/api/settings'). fetch 모킹 금지. 가져오기는 저장 래퍼를 부르지 않는다.
 * - jsdom 에 없는 URL.createObjectURL·revokeObjectURL 은 vi.stubGlobal 대신 URL 정적 속성에 vi.fn 을 심는다.
 * - FileReader 는 jsdom 실물(파일 내용 읽기). 실패·지연은 readAsText 를 spy 로 바꿔 만든다.
 * - 시각 고정은 Date 만 가짜로(vi.useFakeTimers({ toFake: ['Date'] })) — findBy*·waitFor 는 실제 타이머로 돈다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SETTINGS_IMPORT_MAX_BYTES } from '@shared/settings'
import { getCharacterSettings, saveCharacterSettings } from '@/api/settings'
import { SettingsScreen } from '@/settings'
import { downloadText } from '@/settings/download'
import {
  BASE_SETTINGS,
  SAVED_RESPONSE,
  STATUS_SAVED,
  T,
  chars,
  enosBackup,
  enosChar,
  enosWorld,
  fail,
  ok,
  selfFile,
  withCharField,
} from './fixtures'

vi.mock('@/api/settings', () => ({ getCharacterSettings: vi.fn(), saveCharacterSettings: vi.fn() }))

const mockedGet = vi.mocked(getCharacterSettings)
const mockedSave = vi.mocked(saveCharacterSettings)
const NOW = new Date(2026, 9, 6, 9, 5)
const FILE_NAME = 'london-dispatch-characters-20261006-0905.json'

type UrlStatics = { createObjectURL: (b: Blob) => string; revokeObjectURL: (u: string) => void }
const urlStatics = URL as unknown as UrlStatics
const originalUrl = { create: urlStatics.createObjectURL, revoke: urlStatics.revokeObjectURL }

const stubBlobUrl = () => {
  const create = vi.fn((_blob: Blob) => 'blob:settings-1')
  const revoke = vi.fn((_url: string) => {})
  urlStatics.createObjectURL = create
  urlStatics.revokeObjectURL = revoke
  return { create, revoke }
}

const spyAnchorClick = () => {
  const clicked: { download: string; href: string; rel: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href, rel: this.rel })
  })
  return clicked
}

const renderReady = async () => {
  mockedGet.mockResolvedValueOnce(ok(SAVED_RESPONSE))
  const onLeave = vi.fn()
  const onAuthFailure = vi.fn()
  render(<SettingsScreen onLeave={onLeave} onAuthFailure={onAuthFailure} onOwnerLost={vi.fn()} />)
  await screen.findByRole('tablist', { name: T.tabList })
  return { user: userEvent.setup(), onLeave, onAuthFailure }
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement | HTMLInputElement
const statusLine = () => screen.getByRole('status')
type User = ReturnType<typeof userEvent.setup>

const openMenu = async (user: User) => {
  await user.click(button(T.fileMenu))
  return screen.getByRole('dialog', { name: T.fileMenuTitle })
}
const openExport = async (user: User) => {
  await user.click(within(await openMenu(user)).getByRole('button', { name: T.exportItem }))
  return screen.getByRole('dialog', { name: T.exportTitle })
}
const openImport = async (user: User) => {
  await user.click(within(await openMenu(user)).getByRole('button', { name: T.importItem }))
  return screen.getByRole('dialog', { name: T.importTitle })
}
const jsonFile = (content: unknown, name = 'backup.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })
const fileInput = (dialog: HTMLElement) => dialog.querySelector('input[type="file"]') as HTMLInputElement
const pickFile = (dialog: HTMLElement, file: File) => fireEvent.change(fileInput(dialog), { target: { files: [file] } })
const submitOf = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: T.importSubmit }) as HTMLButtonElement
const paste = (dialog: HTMLElement, value: unknown) =>
  fireEvent.change(within(dialog).getByRole('textbox', { name: T.paste }), {
    target: { value: typeof value === 'string' ? value : JSON.stringify(value) },
  })
const importByFile = async (user: User, content: unknown) => {
  const dialog = await openImport(user)
  pickFile(dialog, jsonFile(content))
  await waitFor(() => expect(submitOf(dialog).disabled).toBe(false))
  await user.click(submitOf(dialog))
  return dialog
}
const importByPaste = async (user: User, content: unknown) => {
  const dialog = await openImport(user)
  paste(dialog, content)
  await user.click(submitOf(dialog))
  return dialog
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedSave.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  urlStatics.createObjectURL = originalUrl.create
  urlStatics.revokeObjectURL = originalUrl.revoke
})

describe('내보내기 (R-SET-007 · R-NFR-004)', () => {
  it('TC-ST-022: dirty → ② 텍스트 = 기준값 JSON(초안 아님)·dirty 안내·초기 포커스 · 파일로 저장 → Blob 1회·파일명', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const { create, revoke } = stubBlobUrl()
    const clicked = spyAnchorClick()
    const { user } = await renderReady()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '고친 세계(미저장)' } })

    const sheet = await openExport(user)
    const area = within(sheet).getByRole('textbox', { name: T.exportText }) as HTMLTextAreaElement
    expect(document.activeElement).toBe(area)
    expect(area.readOnly).toBe(true)
    const parsed = JSON.parse(area.value) as Record<string, unknown>
    expect(Object.keys(parsed)).toEqual(['format', 'formatVersion', 'exportedAt', 'settings'])
    expect(parsed.settings).toEqual(BASE_SETTINGS)
    expect(parsed.exportedAt).toBe(NOW.toISOString())
    expect(area.value).not.toMatch(/apiKey|API_KEY|SECRET|token|version"|updatedAt|isDefault/)
    expect(within(sheet).getByText(T.exportDirtyNote)).not.toBeNull()

    await user.click(within(sheet).getByRole('button', { name: T.saveFile }))
    expect(create).toHaveBeenCalledTimes(1)
    const blob = create.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(area.value)
    expect(clicked).toEqual([{ download: FILE_NAME, href: 'blob:settings-1', rel: 'noopener' }])
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:settings-1'))
    expect(screen.getByRole('dialog', { name: T.exportTitle })).not.toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('TC-ST-022: clean 이면 안내 없음 · createObjectURL 예외 → 시트 닫힘·토스트 warning fileSaveFailed', async () => {
    urlStatics.createObjectURL = vi.fn(() => {
      throw new Error('blocked')
    })
    const { user } = await renderReady()
    const sheet = await openExport(user)
    expect(within(sheet).queryByText(T.exportDirtyNote)).toBeNull()
    expect(within(sheet).queryByText(T.exportStaleNote)).toBeNull()
    await user.click(within(sheet).getByRole('button', { name: T.saveFile }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(T.fileSaveFailed)
    expect(toast.classList.contains('warning')).toBe(true)
  })

  it('TC-ST-023: stale → ② 텍스트 = 정규화 초안(stale 뒤 상한 초과 입력도 그대로) · stale 안내', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('tab', { name: T.tabSeb }))
    mockedSave.mockResolvedValueOnce(fail('TOKEN_INVALID'))
    fireEvent.change(textbox('말투, 필수'), { target: { value: '  보관할 말투  ' } })
    await user.click(button(T.save))
    await screen.findByText(T.staleNotice)
    fireEvent.change(textbox('외형'), { target: { value: chars(801) } })

    const sheet = await openExport(user)
    const area = within(sheet).getByRole('textbox', { name: T.exportText }) as HTMLTextAreaElement
    const parsed = JSON.parse(area.value) as { settings: unknown }
    const expected = withCharField(withCharField(BASE_SETTINGS, 'sebastian', 'speech', '보관할 말투'), 'sebastian', 'appearance', chars(801))
    expect(parsed.settings).toEqual(expected)
    expect(within(sheet).getByText(T.exportStaleNote)).not.toBeNull()
    expect(within(sheet).queryByText(T.exportDirtyNote)).toBeNull()
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })
})

describe('가져오기 성공 (R-SET-008)', () => {
  it('TC-ST-024: 자체 형식 파일 → 초안 반영·시트 닫힘·토스트 success 요약 · 저장 미호출 · 되돌리기로 취소', async () => {
    const { user } = await renderReady()
    const imported = withCharField({ ...BASE_SETTINGS, world: '가져온 세계' }, 'ciel', 'speech', '가져온 반말')
    await importByFile(user, selfFile(imported))

    expect(screen.queryByRole('dialog')).toBeNull()
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe('가져왔습니다(공통 1·세바스찬 11·시엘 11). 저장해야 반영됩니다.')
    expect(toast.classList.contains('success')).toBe(true)
    expect(textbox('세계관, 필수').value).toBe('가져온 세계')
    expect(statusLine().textContent).toBe(T.statusDirty)
    expect(mockedSave).not.toHaveBeenCalled()

    await user.click(button(T.revert))
    expect(textbox('세계관, 필수').value).toBe(BASE_SETTINGS.world)
    await user.click(screen.getByRole('tab', { name: T.tabCiel }))
    expect(textbox('말투, 필수').value).toBe(BASE_SETTINGS.characters.ciel.speech)
  })

  it('TC-ST-024: 후보 밖 필드(시엘 말투 801자 미저장)가 있어도 가져오기 성공, 그 뒤 저장만 비활성', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('tab', { name: T.tabCiel }))
    fireEvent.change(textbox('말투, 필수'), { target: { value: chars(801) } })
    await importByFile(user, selfFile({ world: '가져온 세계' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await screen.findByRole('alert')).textContent).toBe('가져왔습니다(공통 1). 저장해야 반영됩니다.')
    expect(textbox('말투, 필수').value).toBe(chars(801))
    expect(statusLine().textContent).toBe('시엘 · 말투는 1~800자여야 합니다.')
    expect(button(T.save).disabled).toBe(true)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-025: (a) E.No.S 백업 붙여넣기 → 매핑 필드만, persona·relationships·rules 유지, 비밀값 DOM 0', async () => {
    const { user } = await renderReady()
    await importByPaste(user, enosBackup([enosChar('세바스찬 미카엘리스'), enosChar('시엘 팬텀하이브')]))

    expect((await screen.findByRole('alert')).textContent).toBe('가져왔습니다(공통 1·세바스찬 8·시엘 8). 저장해야 반영됩니다.')
    expect(textbox('세계관, 필수').value).toBe('안개 낀 런던(E)')
    await user.click(screen.getByRole('tab', { name: T.tabSeb }))
    expect(textbox('말투, 필수').value).toBe('낮고 부드러운 존댓말(E)')
    expect(textbox('샘플 대사').value).toBe('예.\n알겠습니다.')
    expect(textbox('외형').value).toBe('키가 크다\n흑발\n붉은 눈\n흰 장갑')
    expect(textbox('성격·배경, 필수').value).toBe(BASE_SETTINGS.characters.sebastian.persona)
    expect(textbox('관계 메모').value).toBe(BASE_SETTINGS.characters.sebastian.relationships)
    expect(textbox('규칙·금기').value).toBe(BASE_SETTINGS.characters.sebastian.rules.join('\n'))
    expect(document.body.textContent).not.toMatch(/sk-SHOULD-NOT-LEAK|SHOULD-NOT-READ/)
    expect(localStorage.length).toBe(0)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-025: (b) 무시 항목이 있으면 요약 가운데 문장 「무시한 항목 n개.」', async () => {
    const { user } = await renderReady()
    await importByPaste(user, enosBackup([enosChar('세바스찬', { age: 13, gender: {}, sample_dialogue: ['a', 1] })]))
    expect((await screen.findByRole('alert')).textContent).toBe(
      '가져왔습니다(공통 1·세바스찬 6). 무시한 항목 2개. 저장해야 반영됩니다.',
    )
  })

  it('TC-ST-039: 쓸 값이 없는 파일 → 시트 닫힘 · 토스트 warning 가져올 항목이 없습니다. · 초안·dirty 불변', async () => {
    const { user } = await renderReady()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '고친 세계' } })
    await importByPaste(user, selfFile({}))
    expect(screen.queryByRole('dialog')).toBeNull()
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toBe(T.importNothing)
    expect(toast.classList.contains('warning')).toBe(true)
    expect(textbox('세계관, 필수').value).toBe('고친 세계')
    expect(statusLine().textContent).toBe(T.statusDirty)

    await importByPaste(user, selfFile({ world: 5 }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('가져올 항목이 없습니다. 무시한 항목 1개.'),
    )
    expect(textbox('세계관, 필수').value).toBe('고친 세계')
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('가져오기 거부 (R-SET-008)', () => {
  it.each<[string, unknown, string]>([
    ['JSON 아님', 'not json', T.unknownFormat],
    ['모르는 형식', { foo: 1 }, T.unknownFormat],
    ['formatVersion 2', selfFile(BASE_SETTINGS, 2), T.unsupportedVersion],
    ['맞는 world 없음', enosBackup([{ name: '아무개' }]), T.noMatchingWorld],
    ['ciel.speech 801자', selfFile(withCharField(BASE_SETTINGS, 'ciel', 'speech', chars(801))), '시엘 · 말투는 1~800자여야 합니다.'],
    ['world 빈 값', selfFile({ world: '' }), '공통 · 세계관은 1~2000자여야 합니다.'],
    ['sebastian.speech 빈 값', selfFile({ characters: { sebastian: { speech: '' } } }), '세바스찬 · 말투는 1~800자여야 합니다.'],
  ])('TC-ST-026: %s → ③ 오류 줄(role=alert) 문구, 시트 유지, 초안 불변', async (_label, content, message) => {
    const { user } = await renderReady()
    const dialog = await importByPaste(user, content)
    const alert = within(dialog).getByRole('alert')
    expect(alert.textContent).toContain(message)
    expect(screen.getByRole('dialog', { name: T.importTitle })).not.toBeNull()
    await user.click(within(dialog).getByRole('button', { name: T.cancel }))
    expect(textbox('세계관, 필수').value).toBe(BASE_SETTINGS.world)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-026: size > 5MB 파일 → 읽지 않고 거부(FileReader 미호출), 파일 이름 표시', async () => {
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsText')
    const { user } = await renderReady()
    const dialog = await openImport(user)
    const big = jsonFile('{}', 'huge.json')
    Object.defineProperty(big, 'size', { value: SETTINGS_IMPORT_MAX_BYTES + 1 })
    pickFile(dialog, big)
    expect(within(dialog).getByRole('alert').textContent).toContain(T.tooLarge)
    expect(within(dialog).getByText('huge.json')).not.toBeNull()
    expect(readSpy).not.toHaveBeenCalled()
    expect(submitOf(dialog).disabled).toBe(true)
  })

  it('TC-ST-026: FileReader onerror → 「파일을 읽지 못했습니다.」', async () => {
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new ProgressEvent('error')))
    })
    const { user } = await renderReady()
    const dialog = await openImport(user)
    pickFile(dialog, jsonFile(selfFile({ world: 'x' })))
    expect((await within(dialog).findByRole('alert')).textContent).toContain(T.readFailed)
  })
})

describe('가져오기 입력 규칙 (R-SET-008 · D-ST-9)', () => {
  it('TC-ST-027: 둘 다 비면 불러오기 비활성 · 파일 선택 → 붙여넣기 비움 · 붙여넣기 → 「선택한 파일 없음」', async () => {
    const { user } = await renderReady()
    const dialog = await openImport(user)
    expect(submitOf(dialog).disabled).toBe(true)
    expect(within(dialog).getByText(T.noFileChosen)).not.toBeNull()
    expect(within(dialog).getByText(T.importNote)).not.toBeNull()
    paste(dialog, '   ')
    expect(submitOf(dialog).disabled).toBe(true)
    paste(dialog, 'not json')
    await user.click(submitOf(dialog))
    expect(within(dialog).getByRole('alert')).not.toBeNull()

    pickFile(dialog, jsonFile(selfFile({ world: 'x' }), 'mine.json'))
    expect((within(dialog).getByRole('textbox', { name: T.paste }) as HTMLTextAreaElement).value).toBe('')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).getByText('mine.json')).not.toBeNull()
    await waitFor(() => expect(submitOf(dialog).disabled).toBe(false))

    paste(dialog, '{')
    expect(within(dialog).getByText(T.noFileChosen)).not.toBeNull()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('TC-ST-027: 읽는 중 불러오기 비활성 · 시트가 닫힌 뒤 도착한 onload 무시(console.error 0)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const readers: FileReader[] = []
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      readers.push(this)
    })
    const { user } = await renderReady()
    const dialog = await openImport(user)
    pickFile(dialog, jsonFile(selfFile({ world: 'x' })))
    expect(submitOf(dialog).disabled).toBe(true)
    await user.click(within(dialog).getByRole('button', { name: T.cancel }))
    await act(async () => {
      readers[0]?.dispatchEvent(new ProgressEvent('load'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    const reopened = await openImport(user)
    expect(within(reopened).getByText(T.noFileChosen)).not.toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('벡터 화면 통합 (TC-ST-041 — api.md §16.3 ④·⑥)', () => {
  it('TC-ST-041: ④ 자체 ciel.speech 801자 파일 → 오류 줄 시엘 · 말투는 1~800자여야 합니다., 초안 불변', async () => {
    const { user } = await renderReady()
    const dialog = await importByFile(user, selfFile(withCharField(BASE_SETTINGS, 'ciel', 'speech', chars(801))))
    expect(within(dialog).getByRole('alert').textContent).toContain('시엘 · 말투는 1~800자여야 합니다.')
    await user.click(within(dialog).getByRole('button', { name: T.cancel }))
    await user.click(screen.getByRole('tab', { name: T.tabCiel }))
    expect(textbox('말투, 필수').value).toBe(BASE_SETTINGS.characters.ciel.speech)
    expect(statusLine().textContent).toBe(STATUS_SAVED)
  })

  it('TC-ST-041: ⑥ world 단독 + 초안 외형 801자 → 성공·세계관만 바뀜·801자 유지·하단 줄 외형 위반·저장 비활성', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('tab', { name: T.tabSeb }))
    fireEvent.change(textbox('외형'), { target: { value: chars(801) } })
    await importByFile(user, enosWorld([]))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await screen.findByRole('alert')).textContent).toBe('가져왔습니다(공통 1). 저장해야 반영됩니다.')
    expect(textbox('외형').value).toBe(chars(801))
    expect(statusLine().textContent).toBe('세바스찬 · 외형은 800자 이하여야 합니다.')
    expect(button(T.save).disabled).toBe(true)
    await user.click(screen.getByRole('tab', { name: T.tabWorld }))
    expect(textbox('세계관, 필수').value).toBe('안개 낀 런던(E)')
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('시트 포커스 (a11y §2.4·§2.5)', () => {
  it('TC-ST-029: ① 첫 항목 포커스 · Esc → ⋯ · ①→② 닫기 → ⋯ · ①→③ 취소 → ⋯ · ① 취소 → ⋯ · ② Tab 순환', async () => {
    const { user } = await renderReady()
    const menu = await openMenu(user)
    expect(document.activeElement).toBe(within(menu).getByRole('button', { name: T.exportItem }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(button(T.fileMenu)))

    const exportSheet = await openExport(user)
    const closeBtn = within(exportSheet).getByRole('button', { name: T.close })
    within(exportSheet).getByRole('button', { name: T.saveFile }).focus()
    await user.tab()
    expect(document.activeElement).toBe(within(exportSheet).getByRole('textbox', { name: T.exportText }))
    await user.click(closeBtn)
    await waitFor(() => expect(document.activeElement).toBe(button(T.fileMenu)))

    const importSheet = await openImport(user)
    expect(document.activeElement).toBe(within(importSheet).getByRole('button', { name: T.chooseFile }))
    await user.click(within(importSheet).getByRole('button', { name: T.cancel }))
    await waitFor(() => expect(document.activeElement).toBe(button(T.fileMenu)))

    const menu2 = await openMenu(user)
    await user.click(within(menu2).getByRole('button', { name: T.cancel }))
    await waitFor(() => expect(document.activeElement).toBe(button(T.fileMenu)))
  })

  it('TC-ST-029: ④ 취소 → ‹ 포커스', async () => {
    const { user } = await renderReady()
    fireEvent.change(textbox('세계관, 필수'), { target: { value: '고친 세계' } })
    await user.click(button(T.back))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: T.cancel }))
    await waitFor(() => expect(document.activeElement).toBe(button(T.back)))
  })
})

describe('download.ts 단위 (TC-ST-033)', () => {
  it('TC-ST-033: 성공 → true · a.download·rel · a 제거 · setTimeout 0 뒤 revoke', async () => {
    vi.useFakeTimers()
    const { create, revoke } = stubBlobUrl()
    const clicked = spyAnchorClick()
    expect(downloadText('{"a":1}', 'x.json')).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
    expect((create.mock.calls[0]?.[0] as Blob).type).toBe('application/json')
    expect(clicked).toEqual([{ download: 'x.json', href: 'blob:settings-1', rel: 'noopener' }])
    expect(document.querySelectorAll('a')).toHaveLength(0)
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:settings-1')
  })

  it('TC-ST-033: createObjectURL 예외 · Blob 생성 예외 → false, console 0회', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    urlStatics.createObjectURL = vi.fn(() => {
      throw new Error('blocked')
    })
    expect(downloadText('x', 'x.json')).toBe(false)
    stubBlobUrl()
    vi.stubGlobal('Blob', vi.fn(() => {
      throw new Error('no blob')
    }))
    expect(downloadText('x', 'x.json')).toBe(false)
    vi.unstubAllGlobals()
    expect(document.querySelectorAll('a')).toHaveLength(0)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })
})
