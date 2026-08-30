import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import ScanPage from './ScanPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/p/:token" element={<ScanPage />} />
        <Route path="*" element={<Navigate to="/p/invalid" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
