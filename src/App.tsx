import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import LoginPage from './pages/LoginPage';
import ReviewPage from './pages/ReviewPage';
import RecordsPage from './pages/RecordsPage';
import SubmitPage from './pages/SubmitPage';
import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated, canAccessRecords } from './utils/auth';

function RecordsRoute() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!canAccessRecords()) return <Navigate to="/review" replace />;
  return <RecordsPage />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route
            path="/review"
            element={
              <ProtectedRoute>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="/records" element={<RecordsRoute />} />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Routes>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
