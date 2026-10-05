/**
 * 공용 Toast · useToast 스펙 초안 — 단일 소스 ui/src/rooms/test/scenarios.md (TC-RM-032)
 * 대상: ui/src/components/ui/Toast · ui/src/components/hooks/useToast (rooms design/components.md §1.18)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { TOAST_DURATION_MS, useToast } from '@/components/hooks/useToast'
import { Toast } from '@/components/ui/Toast'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Toast (R-CHAT-011)', () => {
  it.each(['warning', 'danger'] as const)('TC-RM-032: p role=alert, 톤 클래스 %s', tone => {
    render(<Toast message="안내" tone={tone} />)
    const alert = screen.getByRole('alert')
    expect(alert.tagName).toBe('P')
    expect(alert.textContent).toBe('안내')
    expect(alert.classList.contains(tone)).toBe(true)
  })
})

describe('useToast (R-CHAT-011)', () => {
  it('TC-RM-032: show → {id 1, message, tone} → 2000ms 뒤 null', () => {
    vi.useFakeTimers()
    expect(TOAST_DURATION_MS).toBe(2000)
    const { result } = renderHook(() => useToast())
    expect(result.current.toast).toBeNull()
    act(() => result.current.showToast('a', 'danger'))
    expect(result.current.toast).toEqual({ id: 1, message: 'a', tone: 'danger' })
    act(() => vi.advanceTimersByTime(1999))
    expect(result.current.toast).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.toast).toBeNull()
  })

  it('TC-RM-032: 1000ms 에 새 show → id 2, 타이머 재시작(첫 호출 기준 2000ms 에 아직 있음)', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())
    act(() => result.current.showToast('a', 'danger'))
    act(() => vi.advanceTimersByTime(1000))
    act(() => result.current.showToast('b', 'warning'))
    expect(result.current.toast).toEqual({ id: 2, message: 'b', tone: 'warning' })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.toast?.message).toBe('b')
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.toast).toBeNull()
  })

  it('TC-RM-032: dismissToast → null, 언마운트 뒤 타이머 0개', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useToast())
    act(() => result.current.showToast('a', 'danger'))
    act(() => result.current.dismissToast())
    expect(result.current.toast).toBeNull()
    act(() => result.current.showToast('b', 'danger'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
