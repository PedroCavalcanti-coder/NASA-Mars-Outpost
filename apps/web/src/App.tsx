import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { RotateGate } from './app/components/RotateGate';
import Game from './app/pages/Game';
import Home from './app/pages/Home';
import { Spinner } from './ui/Empty';
import { Toaster } from './ui/toast';

// A home carrega junto; o resto vem sob demanda.
const Center = lazy(() => import('./app/pages/Center'));
const Support = lazy(() => import('./app/pages/Support'));
const About = lazy(() => import('./app/pages/About'));
const NotFound = lazy(() => import('./app/pages/NotFound'));
const SolarCleaningPreview = lazy(
  () => import('./app/minigames/solar-cleaning/SolarCleaningPreview'),
);

const OxygenFilterPreview = lazy(() => import('./app/minigames/oxygen-filter/OxygenFilterPreview'));
const GreenhousePreview = lazy(() => import('./app/minigames/greenhouse/GreenhousePreview'));
const RoverRepairPreview = lazy(() => import('./app/minigames/rover-repair/RoverRepairPreview'));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="previa/rover" element={<RoverRepairPreview />} />

          {/* Páginas Públicas do Projeto */}
          <Route path="centro" element={<Center />} />
          <Route path="suporte" element={<Support />} />
          <Route path="sobre" element={<About />} />

          <Route path="jogar" element={<Game />} />
          <Route path="previa/painel-solar" element={<SolarCleaningPreview />} />
          <Route path="previa/filtro-oxigenio" element={<OxygenFilterPreview />} />
          <Route path="previa/estufa" element={<GreenhousePreview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
      <RotateGate />
    </BrowserRouter>
  );
}
