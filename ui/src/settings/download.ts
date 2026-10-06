/**
 * 텍스트 파일 내려받기 — 설계 settings/design/components.md §3.10 · 요구 R-SET-007
 * Blob → object URL → 보이지 않는 a[download] 클릭. 새 패키지·서버 요청 없음. 상태 모듈을 순수하게 두려고 DOM 부수효과는 여기에 둔다.
 * iframe sandbox 가 다운로드를 조용히 막으면 감지할 수 없다. 화면의 복사용 텍스트가 대체 경로다(한계 L-ST-2).
 * 로그를 남기지 않는다(파일 내용·결과 모두).
 */

/** a 요소를 잠깐 문서에 붙여 눌렀다가 반드시 뗀다 */
const clickAnchor = (url: string, fileName: string): void => {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
  }
}

/** Blob 다운로드. 예외가 나면 false. 성공 여부(실제 저장)는 브라우저가 알려 주지 않는다 */
export const downloadText = (
  text: string,
  fileName: string,
  mime = 'application/json',
): boolean => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    clickAnchor(url, fileName)
    // 클릭이 URL 을 읽은 뒤에 풀어 준다
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
