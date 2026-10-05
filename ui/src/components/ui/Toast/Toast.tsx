/**
 * 공용 Toast — 설계 rooms/design/components.md §1.18 · 요구 R-CHAT-011
 * 화면 아래쪽 한 줄 알림. role=alert, 톤은 클래스(warning · danger)로 가른다. 문구는 호출 쪽(labels.ts)이 정한다.
 * 화면은 <Toast key={toast.id} …/> 로 렌더해 같은 문구도 다시 읽히게 한다. 위치·시간은 화면과 useToast 가 정한다.
 */
import { cx } from '@/components/utils/cx'
import styles from './Toast.module.css'

export type ToastTone = 'warning' | 'danger'
export type ToastProps = { message: string; tone: ToastTone }

export const Toast = ({ message, tone }: ToastProps) => (
  <p className={cx(styles.root, styles[tone])} role="alert">
    {message}
  </p>
)
