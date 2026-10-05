/**
 * RoomList — 설계 rooms/design/components.md §2.2 · 요구 R-ROOMS-001 · R-ROOM-001
 * ul(aria-label 없음) → 방마다 li > ListRow. 순서는 받은 배열 그대로다(서버가 updatedAt 내림차순 보장, 화면은 다시 정렬하지 않는다).
 * 날짜는 마지막 갱신(updatedAt)의 MM.DD.
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

export const RoomList = ({ rooms, onSelect }: RoomListProps) => (
  <ul className={styles.root}>
    {rooms.map(room => {
      const dateText = formatMonthDay(room.updatedAt)
      return (
        <li key={room.id}>
          <ListRow
            title={room.title}
            dateText={dateText}
            dateTime={toIsoDate(room.updatedAt)}
            ariaLabel={labels.rowAriaLabel(room.title, dateText)}
            onSelect={() => onSelect(room)}
          />
        </li>
      )
    })}
  </ul>
)
