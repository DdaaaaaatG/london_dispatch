/**
 * roomKeys — 방 입장 증명 보관. 설계 rooms/design/components.md §1.21 · design/lock.md F-RM-30 ~ F-RM-37 · 요구 R-LOCK-004 · R-LOCK-007
 * 비유: 방마다 받은 도장을 적는 수첩. 서랍(저장소)이 잠겨 있어도 이번에 열어 둔 수첩(메모리)으로 계속 쓴다. 출입증(토큰)은 이 수첩에 적지 않는다.
 * 저장 형식은 `[roomId, entryKey]` 쌍 배열 JSON(오래된 것이 앞), 상한 50. 저장소 접근은 components/utils/storage.ts 원문 3함수만 쓴다.
 * 증명은 불투명 문자열이다 — 해석·형식 검사·로그 출력을 하지 않는다(api.md §2.8.1). 비밀번호·토큰은 이 모듈에 들어오지 않는다.
 */
import { clearRoomKeysRaw, loadRoomKeysRaw, saveRoomKeysRaw } from '@/components/utils/storage'

/** 보관 상한. 넘으면 가장 오래 저장한 쌍부터 버린다 */
export const ROOM_KEYS_MAX = 50

export type RoomKeyEntry = readonly [roomId: string, entryKey: string]

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

/** 정확히 길이 2 이고 두 값이 모두 빈 문자열이 아닌 string 인 원소만 쌍으로 인정한다 */
const toEntry = (item: unknown): RoomKeyEntry | null => {
  if (!Array.isArray(item) || item.length !== 2) return null
  const [roomId, entryKey]: unknown[] = item
  return isNonEmptyString(roomId) && isNonEmptyString(entryKey) ? [roomId, entryKey] : null
}

/** 뒤쪽(최신) 상한 개수만 남긴다 */
const capEntries = (entries: readonly RoomKeyEntry[]): readonly RoomKeyEntry[] =>
  entries.length > ROOM_KEYS_MAX ? entries.slice(entries.length - ROOM_KEYS_MAX) : entries

/**
 * F-RM-30: 저장소 원문 → 쌍 배열. null · 빈 문자열 · 깨진 JSON · 배열 아님 → [].
 * 같은 방 id 가 여러 번이면 마지막 쌍이 이기고 그 쌍은 맨 뒤(최신)에 둔다. 길이가 50 을 넘으면 뒤쪽 50개.
 */
export const parseRoomKeys = (raw: string | null): readonly RoomKeyEntry[] => {
  if (raw === null || raw === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const latestByRoom = new Map<string, string>()
  for (const item of parsed) {
    const entry = toEntry(item)
    if (entry === null) continue
    latestByRoom.delete(entry[0])
    latestByRoom.set(entry[0], entry[1])
  }
  return capEntries(
    Array.from(latestByRoom, ([roomId, entryKey]): RoomKeyEntry => [roomId, entryKey]),
  )
}

/** F-RM-31: 같은 방 쌍을 빼고 맨 뒤에 붙인다. 상한을 넘으면 앞(가장 오래된 것)부터 버린다. 입력은 바꾸지 않는다 */
export const upsertRoomKey = (
  entries: readonly RoomKeyEntry[],
  roomId: string,
  entryKey: string,
): readonly RoomKeyEntry[] =>
  capEntries([...entries.filter(([id]) => id !== roomId), [roomId, entryKey]])

/** F-RM-32: 해당 방 쌍을 뺀 새 배열 */
export const removeRoomKey = (
  entries: readonly RoomKeyEntry[],
  roomId: string,
): readonly RoomKeyEntry[] => entries.filter(([id]) => id !== roomId)

/** F-RM-32: 방의 증명. 없으면 null */
export const findRoomKey = (entries: readonly RoomKeyEntry[], roomId: string): string | null =>
  entries.find(([id]) => id === roomId)?.[1] ?? null

/** F-RM-33: 빈 배열이면 null(= 저장소 키 삭제), 아니면 JSON */
export const serializeRoomKeys = (entries: readonly RoomKeyEntry[]): string | null =>
  entries.length === 0 ? null : JSON.stringify(entries)

/** 메모리 슬롯. 첫 접근 때 저장소를 1회 읽고 이후 읽기는 캐시만 본다. 바꾸는 곳은 이 클로저뿐이다 */
const createRoomKeyCache = () => {
  let entries: readonly RoomKeyEntry[] | null = null
  const read = (): readonly RoomKeyEntry[] => {
    entries ??= parseRoomKeys(loadRoomKeysRaw())
    return entries
  }
  /** 내부 commit: 캐시 → 저장소 순. 저장소 실패는 storage 가 삼켜 이번 세션은 캐시로 동작한다 */
  const commit = (next: readonly RoomKeyEntry[]): void => {
    entries = next
    const json = serializeRoomKeys(next)
    if (json === null) clearRoomKeysRaw()
    else saveRoomKeysRaw(json)
  }
  const reset = (): void => {
    entries = null
  }
  return { read, commit, reset }
}
const cache = createRoomKeyCache()

/** F-RM-34: 방의 저장된 증명. main.tsx 가 configureClient({ getToken, getRoomKey }) 에 그대로 넘기는 getter 다 */
export const getRoomKey = (roomId: string): string | null => findRoomKey(cache.read(), roomId)

/** F-RM-35: 증명 저장. 빈 증명은 무시한다. 증명을 해석·검사하지 않는다(불투명 문자열) */
export const saveRoomKey = (roomId: string, entryKey: string): void => {
  if (entryKey === '') return
  cache.commit(upsertRoomKey(cache.read(), roomId, entryKey))
}

/** F-RM-36: 증명 삭제. 캐시에 그 방이 없으면 저장소를 건드리지 않는다 */
export const forgetRoomKey = (roomId: string): void => {
  const current = cache.read()
  if (findRoomKey(current, roomId) === null) return
  cache.commit(removeRoomKey(current, roomId))
}

/** F-RM-37: 캐시를 비운다. 테스트 정리 전용(token.ts clearToken 과 같은 성격) — 화면 코드는 부르지 않는다 */
export const resetRoomKeyCache = (): void => cache.reset()
