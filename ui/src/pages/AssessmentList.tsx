import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Assessment, AssessmentStatus } from '../types';
import { fetchAssessments } from '../mock/api';
import Spinner from '../components/Spinner';

const statusConfig: Record<AssessmentStatus, { label: string; className: string; dot: string }> = {
  draft: {
    label: 'Draft',
    className: 'badge badge-pending',
    dot: 'bg-amber-400',
  },
  active: {
    label: 'Active',
    className: 'badge badge-completed',
    dot: 'bg-emerald-400',
  },
  archived: {
    label: 'Archived',
    className: 'badge bg-slate-500/15 text-slate-400 border border-slate-500/20',
    dot: 'bg-slate-400',
  },
};

function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const config = statusConfig[status];
  return (
    <span className={config.className}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}></span>
      {config.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssessmentList() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssessmentStatus | 'all'>('all');

  useEffect(() => {
    fetchAssessments().then((data) => {
      setAssessments(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  const filtered = filter === 'all' ? assessments : assessments.filter((a) => a.status === filter);

  const counts = {
    all: assessments.length,
    draft: assessments.filter((a) => a.status === 'draft').length,
    active: assessments.filter((a) => a.status === 'active').length,
    archived: assessments.filter((a) => a.status === 'archived').length,
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Assessments</h1>
          <p className="text-slate-400 mt-1">Manage your hiring assessments and evaluations.</p>
        </div>
        <Link to="/assessments/create" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Assessment
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'draft', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === status
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-xs opacity-70">{counts[status]}</span>
          </button>
        ))}
      </div>

      {/* Assessment Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((assessment, idx) => (
          <Link
            key={assessment.id}
            to={`/assessments/${assessment.id}`}
            className="card card-hover group animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between mb-3">
              <AssessmentStatusBadge status={assessment.status} />
              <svg
                className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-1 group-hover:text-indigo-400 transition-colors">
              {assessment.title}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{assessment.role}</p>
            {assessment.description && (
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">{assessment.description}</p>
            )}
            <div className="flex items-center gap-4 pt-3 border-t border-slate-800/50">
              {assessment.config.tech_stack && assessment.config.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assessment.config.tech_stack.slice(0, 3).map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400 rounded-md"
                    >
                      {tech}
                    </span>
                  ))}
                  {assessment.config.tech_stack.length > 3 && (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-500 rounded-md">
                      +{assessment.config.tech_stack.length - 3}
                    </span>
                  )}
                </div>
              )}
              <span className="text-xs text-slate-500 ml-auto">{formatDate(assessment.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">No assessments found.</p>
          <Link to="/assessments/create" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
            Create your first assessment &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
