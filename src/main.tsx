import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { PlayPage } from './pages/PlayPage'
import { AnalyzePage } from './pages/AnalyzePage'
import { PuzzlesPage } from './pages/PuzzlesPage'
import { WeaknessesPage } from './pages/WeaknessesPage'
import './styles/global.css'

const basename = import.meta.env.BASE_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="play" element={<PlayPage />} />
          <Route path="analyze" element={<AnalyzePage />} />
          <Route path="puzzles" element={<PuzzlesPage />} />
          <Route path="weaknesses" element={<WeaknessesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
