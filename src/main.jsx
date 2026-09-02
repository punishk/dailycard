import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

/**
 * 서비스 워커 등록 — 홈 화면 설치와 오프라인 열람을 담당합니다.
 * 개발 중(npm run dev)에는 캐시가 방해되므로 빌드된 앱에서만 켭니다.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker.register(swUrl).catch((err) => {
      // 등록에 실패해도 앱은 그대로 동작한다
      console.warn('서비스 워커 등록 실패:', err)
    })
  })
}
