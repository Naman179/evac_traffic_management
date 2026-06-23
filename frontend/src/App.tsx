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
        <div className="flex min-h-screen bg-surface-950 text-surface-100">
          <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          <main className={`flex-1 p-8 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
            <div className="max-w-7xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/predict" element={<PredictionPage />} />
                <Route path="/heatmap" element={<HeatmapPage />} />
                <Route path="/anomaly" element={<AnomalyPage />} />
                <Route path="/route" element={<RoutePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
              </Routes>
            </div>
          </main>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#151a1d',
              color: '#f3f4f6',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
