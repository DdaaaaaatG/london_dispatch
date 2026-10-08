/**
 * RoomList — 설계 rooms/design/components.md §2.2 · design/lock.md F-RM-54 · 요구 R-ROOMS-001 · R-ROOM-001 · R-LOCK-003
 * ul(aria-label 없음) → 방마다 li > ListRow. 순서는 받은 배열 그대로다(서버가 updatedAt 내림차순 보장, 화면은 다시 정렬하지 않는다).
 * 안 잠긴 방은 마지막 갱신(updatedAt)의 MM.DD 를 보이고, (S6) 잠긴 방은 날짜를 계산하지도 넘기지도 않는다(자물쇠 + 제목만).
 */
import type { RoomSummary } from '@shared/types'
import { formatMonthDay, toIsoDate } from '@/components/utils/formatDate'
import { labels } from '@/rooms/labels'
import { ListRow } from './ListRow'
import styles from './RoomList.module.css'

export type RoomListProps = {
  rooms: readonly RoomSummary[]
  onSelect: (room: RoomSummary) => void
}

type RoomRowProps = { room: RoomSummary; onSelect: (room: RoomSummary) => void }

const RoomRow = ({ room, onSelect }: RoomRowProps) => {
  if (room.locked) {
    return (
      <ListRow
        isLocked
        title={room.title}
        ariaLabel={labels.lockedRowAriaLabel(room.title)}
        onSelect={() => onSelect(room)}
      />
    )
  }
  const dateText = formatMonthDay(room.updatedAt)
  return (
    <ListRow
      title={room.title}
      dateText={dateText}
      dateTime={toIsoDate(room.updatedAt)}
      ariaLabel={labels.rowAriaLabel(room.title, dateText)}
      onSelect={() => onSelect(room)}
    />
  )
}

export const RoomList = ({ rooms, onSelect }: RoomListProps) => (
  <ul className={styles.root}>
    {rooms.map(room => (
      <li key={room.id}>
        <RoomRow room={room} onSelect={onSelect} />
      </li>
    ))}
  </ul>
)
