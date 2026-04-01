import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import SignIn from './pages/SignIn';
import Overview from './pages/Overview';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Resourcing from './pages/Resourcing';
import Partners from './pages/Partners';
import Scout from './pages/Scout';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: true },
  },
});

function AppRoutes() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Routes>
      <Route
        path="/signin"
        element={isAuthenticated ? <Navigate to="/overview" replace /> : <SignIn />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="resourcing" element={<Resourcing />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partners/:id" element={<Partners />} />
        <Route path="scout" element={<Scout />} />
        <Route
          path="settings"
          element={
            user?.role === 'EP' ? <Settings /> : <Navigate to="/overview" replace />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
