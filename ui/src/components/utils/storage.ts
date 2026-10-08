/**
 * localStorage 단일 접근 지점 — 설계 rooms/design/components.md §1.7 · F-RM-10
 * 요구: R-ROOMS-004 · R-CHAT-010 · R-NFR-004(토큰은 어떤 키로도 저장하지 않는다) · R-LOCK-004(S6 입장 증명 원문 — 토큰이 아니다)
 * 비유: 책갈피 서랍. 서랍이 잠겨 있어도(사생활 모드·iframe 저장 차단) 열람은 계속된다. 서랍을 여는 손은 이 파일 하나뿐이다.
 * 모든 함수는 접근 전체를 try/catch 로 감싼다. 읽기 실패·값 없음 = null, 쓰기·삭제 실패 = 조용히 무시(로그 없음).
 */
export const STORAGE_KEYS = {
  lastRoomId: 'ld:lastRoomId',
  roomKeys: 'ld:roomKeys',
  scrollOffset: (roomId: string) => `ld:scroll:${roomId}`,
} as const

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 저장 불가 환경 — 기능만 포기하고 화면은 계속 동작한다
  }
}

const remove = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 저장 불가 환경 — 무시
  }
}

/** 마지막으로 본 방 id. 없거나 빈 문자열이면 null */
export const loadLastRoomId = (): string | null => {
  const value = read(STORAGE_KEYS.lastRoomId)
  return value === null || value === '' ? null : value
}

export const saveLastRoomId = (roomId: string): void => write(STORAGE_KEYS.lastRoomId, roomId)

export const clearLastRoomId = (): void => remove(STORAGE_KEYS.lastRoomId)

/** 방별 스크롤 위치(맨 아래로부터의 거리 px). 0 이상 유한수가 아니면 null */
export const loadScrollOffset = (roomId: string): number | null => {
  const raw = read(STORAGE_KEYS.scrollOffset(roomId))
  if (raw === null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** 0 이상 정수로 반올림해 저장한다 */
export const saveScrollOffset = (roomId: string, distanceFromBottom: number): void =>
  write(STORAGE_KEYS.scrollOffset(roomId), String(Math.max(0, Math.round(distanceFromBottom))))

/** (S6) 방 입장 증명 원문 JSON. 해석(파싱·상한·중복)은 state/roomKeys.ts 가 한다. 없거나 빈 문자열이면 null */
export const loadRoomKeysRaw = (): string | null => {
  const value = read(STORAGE_KEYS.roomKeys)
  return value === null || value === '' ? null : value
}

export const saveRoomKeysRaw = (json: string): void => write(STORAGE_KEYS.roomKeys, json)

export const clearRoomKeysRaw = (): void => remove(STORAGE_KEYS.roomKeys)
