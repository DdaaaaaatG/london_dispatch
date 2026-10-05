/**
 * 진입점 — 설계 rooms/design/functions.md §1.1 · 주 문서 §11.2 D-2 · components.md §1.10 · api.md §2.4
 * 렌더 전에 토큰(?t=)을 한 번 파싱해 메모리 슬롯에 넣고(initToken), 쓰기 래퍼가 그 슬롯을 읽도록 getter 를 건네고(configureClient),
 * App 만 렌더한다. 화면 분기는 App 이 한다(App 을 테스트할 수 있게 분리).
 * initToken · configureClient 를 부르는 곳은 이 파일뿐이다. URL 은 고치지 않고 토큰은 저장소·쿠키에 두지 않는다.
 */
import { createRoot } from 'react-dom/client'
import { configureClient } from '@/api'
import { App } from '@/App'
import { getToken, initToken } from '@/state/token'
import '@/styles/global.css'

initToken(window.location.search)
configureClient({ getToken })

const container = document.getElementById('root')
if (container !== null) createRoot(container).render(<App />)
