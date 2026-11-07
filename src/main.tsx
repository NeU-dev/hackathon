import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { DeviceFrame, useDeviceFrame } from './DeviceFrame'

/** 広い画面ではスマホの大きさの窓に入れる（窓の中では、いつもどおり画面いっぱい） */
function Root() {
  return useDeviceFrame() ? <DeviceFrame /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
