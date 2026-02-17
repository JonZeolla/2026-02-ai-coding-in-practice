import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Assessment, Candidate, AssessmentStatus, CandidateStatus } from '../types';
import { fetchAssessment, fetchCandidatesForAssessment } from '../mock/api';
import Spinner from '../components/Spinner';

const assessmentStatusConfig: Record<AssessmentStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Draft', className: 'badge badge-pending', dot: 'bg-amber-400' },
  active: { label: 'Active', className: 'badge badge-completed', dot: 'bg-emerald-400' },
  archived: { label: 'Archived', className: 'badge bg-slate-500/15 text-slate-400 border border-slate-500/20', dot: 'bg-slate-400' },
};

const candidateStatusConfig: Record<CandidateStatus, { label: string; className: string; dot: string }> = {
  invited: { label: 'Invited', className: 'badge bg-purple-500/15 text-purple-400 border border-purple-500/20', dot: 'bg-purple-400' },
  in_progress: { label: 'In Progress', className: 'badge badge-processing', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: 'Completed', className: 'badge badge-completed', dot: 'bg-emerald-400' },
  scored: { label: 'Scored', className: 'badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20', dot: 'bg-indigo-400' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchAssessment(id), fetchCandidatesForAssessment(id)]).then(
      ([assessmentData, candidateData]) => {
        if (!assessmentData) {
          setNotFound(true);
        } else {
          setAssessment(assessmentData);
          setCandidates(candidateData);
        }
        setLoading(false);
      }
    );
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound || !assessment) {
    return (
      <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
        <p className="text-2xl font-bold text-slate-300 mb-2">Assessment Not Found</p>
        <p className="text-slate-500 mb-6">The assessment you're looking for doesn't exist.</p>
        <Link to="/assessments" className="btn-primary">Back to Assessments</Link>
      </div>
    );
  }

  const statusCfg = assessmentStatusConfig[assessment.status];
  const candidateCounts = {
    total: candidates.length,
    invited: candidates.filter((c) => c.status === 'invited').length,
    in_progress: candidates.filter((c) => c.status === 'in_progress').length,
    completed: candidates.filter((c) => c.status === 'completed').length,
    scored: candidates.filter((c) => c.status === 'scored').length,
  };

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/assessments" className="hover:text-slate-300 transition-colors">Assessments</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-slate-300">{assessment.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-100">{assessment.title}</h1>
            <span className={statusCfg.className}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusCfg.dot}`}></span>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-slate-400">{assessment.role}</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          Invite Candidate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Details */}
        <div className="lg:col-span-1 space-y-5">
          {/* Description */}
          {assessment.description && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{assessment.description}</p>
            </div>
          )}

          {/* Rubric */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Rubric</h3>
            <div className="space-y-3">
              {assessment.rubric.map((criterion) => (
                <div key={criterion.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200">{criterion.name}</span>
                    <span className="text-xs text-indigo-400 font-semibold">{criterion.weight}%</span>
                  </div>
                  <p className="text-xs text-slate-500">{criterion.description}</p>
                  <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${criterion.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          {assessment.config.tech_stack && assessment.config.tech_stack.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                {assessment.config.tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Config */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Configuration</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Interview Duration</dt>
                <dd className="text-slate-300">{assessment.config.interview_duration_minutes ?? 45} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">PR Review</dt>
                <dd className="text-slate-300">{assessment.config.pr_review_enabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-300">{formatDate(assessment.created_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right column - Candidates */}
        <div className="lg:col-span-2">
          {/* Candidate Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total', count: candidateCounts.total, color: 'text-slate-300' },
              { label: 'In Progress', count: candidateCounts.in_progress, color: 'text-blue-400' },
              { label: 'Completed', count: candidateCounts.completed, color: 'text-emerald-400' },
              { label: 'Scored', count: candidateCounts.scored, color: 'text-indigo-400' },
            ].map((stat) => (
              <div key={stat.label} className="card text-center py-4">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Candidate List */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Candidates</h3>
            {candidates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No candidates yet. Invite someone to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidates.map((candidate, idx) => {
                  const cStatusCfg = candidateStatusConfig[candidate.status];
                  return (
                    <Link
                      key={candidate.id}
                      to={`/candidates/${candidate.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 group animate-slide-in-right"
                      style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {candidate.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{candidate.name}</p>
                          <p className="text-xs text-slate-500 truncate">{candidate.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {candidate.overall_score !== undefined && (
                          <span className="text-sm font-semibold text-indigo-400">
                            {candidate.overall_score.toFixed(1)}
                          </span>
                        )}
                        <span className={cStatusCfg.className}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cStatusCfg.dot}`}></span>
                          {cStatusCfg.label}
                        </span>
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
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
