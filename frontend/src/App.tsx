import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PredictionPage from './pages/PredictionPage';
import HeatmapPage from './pages/HeatmapPage';
import AnomalyPage from './pages/AnomalyPage';
import RoutePage from './pages/RoutePage';
import AnalyticsPage from './pages/AnalyticsPage';
import MonitoringPage from './pages/MonitoringPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0b0f10' }}>
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(prev => !prev)}
          />
          <main
            className={`main-content ${isSidebarCollapsed ? 'sidebar-closed' : 'sidebar-open'}`}
            style={{ flex: 1, overflowX: 'hidden' }}
          >
            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
              <Routes>
                <Route path="/"          element={<Dashboard />} />
                <Route path="/predict"   element={<PredictionPage />} />
                <Route path="/heatmap"   element={<HeatmapPage />} />
                <Route path="/anomaly"   element={<AnomalyPage />} />
                <Route path="/route"     element={<RoutePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/monitoring"element={<MonitoringPage />} />
              </Routes>
            </div>
          </main>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1b2024',
              color: '#e5e7eb',
              border: '1px solid rgba(46,204,113,0.2)',
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
            },
            success: {
              iconTheme: { primary: '#2ecc71', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
