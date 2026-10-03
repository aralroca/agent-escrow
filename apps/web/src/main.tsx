import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { Agents } from './pages/Agents.tsx';
import { Developers } from './pages/Developers.tsx';
import { JobDetail } from './pages/JobDetail.tsx';
import { Jobs } from './pages/Jobs.tsx';
import { Landing } from './pages/Landing.tsx';
import { NotFound, Security } from './pages/Security.tsx';

// Layout is imported first so the base styles load before every page stylesheet.
// Hash routing: GitHub Pages serves one file, so every route must live after the "#".
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:address" element={<JobDetail />} />
          <Route path="agents" element={<Agents />} />
          <Route path="developers" element={<Developers />} />
          <Route path="security" element={<Security />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
