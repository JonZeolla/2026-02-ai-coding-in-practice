import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SubmitJob from './pages/SubmitJob';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';
import AssessmentList from './pages/AssessmentList';
import CreateAssessment from './pages/CreateAssessment';
import AssessmentDetail from './pages/AssessmentDetail';
import CandidateDetail from './pages/CandidateDetail';
import CandidatePortal from './pages/CandidatePortal';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Candidate portal - clean layout without sidebar */}
        <Route path="/candidate" element={<CandidatePortal />} />

        {/* Recruiter UI with sidebar */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-slate-950">
              <Sidebar />
              <main className="pl-64 min-h-screen">
                <div className="p-8">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/submit" element={<SubmitJob />} />
                    <Route path="/jobs" element={<JobList />} />
                    <Route path="/jobs/:id" element={<JobDetail />} />
                    <Route path="/assessments" element={<AssessmentList />} />
                    <Route path="/assessments/create" element={<CreateAssessment />} />
                    <Route path="/assessments/:id" element={<AssessmentDetail />} />
                    <Route path="/candidates/:id" element={<CandidateDetail />} />
                  </Routes>
                </div>
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
