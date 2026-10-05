/**
 * 진입점 — 설계 rooms/design/functions.md §1.1 · 주 문서 §11.2 D-2
 * 전역 스타일을 불러오고 App 만 렌더한다. 화면 분기는 App 이 한다(App 을 테스트할 수 있게 분리).
 * 토큰(?t=)은 S1 에서 읽지 않는다. S2 에서 이 파일이 한 번 파싱해 메모리로만 넘긴다.
 */
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import '@/styles/global.css'

const container = document.getElementById('root')
if (container !== null) createRoot(container).render(<App />)
