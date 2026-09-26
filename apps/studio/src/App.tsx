import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from './components/shell/AppShell';
import { Compare } from './routes/Compare';
import { Dashboard } from './routes/Dashboard';
import { Landing } from './routes/Landing';
import { Login } from './routes/Login';
import { Register } from './routes/Register';
import { RequireAuth } from './routes/RequireAuth';
import { Studio } from './routes/Studio';

// Dev-only preview of the 3D viewer (F2.md), lazy so `three` stays out of the
// landing/login bundle (F2.md VERIFY).
const DevViewer = lazy(() => import('./viewer/DevViewer').then((m) => ({ default: m.DevViewer })));

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dev/viewer"
          element={
            <Suspense fallback={null}>
              <DevViewer />
            </Suspense>
          }
        />
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/design/:id" element={<Studio />} />
          <Route path="/app/compare" element={<Compare />} />
        </Route>
      </Route>
    </Routes>
  );
}
