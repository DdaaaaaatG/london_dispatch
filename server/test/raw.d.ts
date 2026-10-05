// Vite ?raw import 타입 (SRV-T-011 키 대조용)
declare module '*?raw' {
  const content: string
  export default content
}
