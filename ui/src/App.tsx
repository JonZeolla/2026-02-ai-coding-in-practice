import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SubmitJob from './pages/SubmitJob';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        <Sidebar />
        <main className="pl-64 min-h-screen">
          <div className="p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/submit" element={<SubmitJob />} />
              <Route path="/jobs" element={<JobList />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
