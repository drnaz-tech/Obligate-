import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout, PublicLayout } from '@/components/layouts/Shell';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from './routes';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!profile?.is_admin) return <Navigate to="/restricted" replace />;
  return <>{children}</>;
}

const App: React.FC = () => {
  const publicRoutes = routes.filter((r) => r.layout === 'public');
  const appRoutes = routes.filter((r) => r.layout === 'app');
  const bareRoutes = routes.filter((r) => r.layout === 'bare');

  return (
    <Router>
      <AuthProvider>
        <IntersectObserver />
        <Routes>
          <Route element={<PublicLayout />}>
            {publicRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Route>

          <Route
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            {appRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={route.admin ? <AdminOnly>{route.element}</AdminOnly> : route.element}
              />
            ))}
          </Route>

          {bareRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
};

export default App;
