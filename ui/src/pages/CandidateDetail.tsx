import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Candidate, CandidateStatus, Score, InterviewSession,
  PrExercise, BehavioralSignal, Assessment,
} from '../types';
import {
  fetchCandidate, fetchScoreForCandidate, fetchInterviewSession,
  fetchPrExercise, fetchBehavioralSignals, fetchAssessment,
} from '../mock/api';
import Spinner from '../components/Spinner';

const candidateStatusConfig: Record<CandidateStatus, { label: string; className: string; dot: string }> = {
  invited: { label: 'Invited', className: 'badge bg-purple-500/15 text-purple-400 border border-purple-500/20', dot: 'bg-purple-400' },
  in_progress: { label: 'In Progress', className: 'badge badge-processing', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: 'Completed', className: 'badge badge-completed', dot: 'bg-emerald-400' },
  scored: { label: 'Scored', className: 'badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20', dot: 'bg-indigo-400' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-indigo-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-slate-200">{score.toFixed(1)}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [prExercise, setPrExercise] = useState<PrExercise | null>(null);
  const [signals, setSignals] = useState<BehavioralSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'scores' | 'interview' | 'pr_review' | 'behavioral'>('scores');

  useEffect(() => {
    if (!id) return;
    fetchCandidate(id).then(async (cand) => {
      if (!cand) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCandidate(cand);
      const [assessmentData, scoreData, interviewData, prData, signalData] = await Promise.all([
        fetchAssessment(cand.assessment_id),
        fetchScoreForCandidate(id),
        fetchInterviewSession(id),
        fetchPrExercise(id),
        fetchBehavioralSignals(id),
      ]);
      setAssessment(assessmentData);
      setScore(scoreData);
      setInterview(interviewData);
      setPrExercise(prData);
      setSignals(signalData);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
        <p className="text-2xl font-bold text-slate-300 mb-2">Candidate Not Found</p>
        <p className="text-slate-500 mb-6">The candidate you're looking for doesn't exist.</p>
        <Link to="/assessments" className="btn-primary">Back to Assessments</Link>
      </div>
    );
  }

  const statusCfg = candidateStatusConfig[candidate.status];

  const tabs = [
    { key: 'scores' as const, label: 'Scores', available: !!score },
    { key: 'interview' as const, label: 'Interview', available: !!interview },
    { key: 'pr_review' as const, label: 'PR Review', available: !!prExercise },
    { key: 'behavioral' as const, label: 'Behavioral', available: signals.length > 0 },
  ];

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/assessments" className="hover:text-slate-300 transition-colors">Assessments</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        {assessment && (
          <>
            <Link to={`/assessments/${assessment.id}`} className="hover:text-slate-300 transition-colors">
              {assessment.title}
            </Link>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </>
        )}
        <span className="text-slate-300">{candidate.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white shrink-0">
          {candidate.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-slate-100">{candidate.name}</h1>
            <span className={statusCfg.className}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusCfg.dot}`}></span>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-slate-400">{candidate.email}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            {assessment && <span>{assessment.title}</span>}
            <span>Added {formatDate(candidate.created_at)}</span>
            {'source' in candidate.metadata && candidate.metadata.source ? (
              <span className="px-2 py-0.5 bg-slate-800 rounded text-xs">{String(candidate.metadata.source)}</span>
            ) : null}
          </div>
        </div>
        {score && (
          <div className="card text-center px-6 py-4 shrink-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overall Score</p>
            <p className="text-4xl font-bold text-indigo-400">{score.overall_score.toFixed(1)}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800/50 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            disabled={!tab.available}
            className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-lg ${
              activeTab === tab.key
                ? 'bg-slate-800/80 text-slate-100 border-b-2 border-indigo-500'
                : tab.available
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {/* Scores Tab */}
        {activeTab === 'scores' && score && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Score Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(score.breakdown).map(([criterion, value]) => (
                  <ScoreBar key={criterion} label={criterion} score={value} />
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Reasoning</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{score.reasoning}</p>
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <p className="text-xs text-slate-500">Scored on {formatDate(score.scored_at)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scores' && !score && (
          <div className="card text-center py-12">
            <p className="text-slate-500">Scores are not yet available for this candidate.</p>
          </div>
        )}

        {/* Interview Tab */}
        {activeTab === 'interview' && interview && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Interview Transcript</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {interview.started_at && <span>Started {formatDate(interview.started_at)}</span>}
                <span className="badge badge-completed">
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-400"></span>
                  {interview.status}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {interview.conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'interviewer' ? '' : 'flex-row-reverse'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    msg.role === 'interviewer'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  }`}>
                    {msg.role === 'interviewer' ? 'AI' : candidate.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === 'interviewer'
                      ? 'bg-slate-800/60 text-slate-300'
                      : 'bg-indigo-600/20 text-slate-200 border border-indigo-500/20'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'interview' && !interview && (
          <div className="card text-center py-12">
            <p className="text-slate-500">No interview session found for this candidate.</p>
          </div>
        )}

        {/* PR Review Tab */}
        {activeTab === 'pr_review' && prExercise && (
          <div className="space-y-6">
            {/* PR Details */}
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">{prExercise.generated_data.title}</h3>
              <p className="text-sm text-slate-400 mb-4">{prExercise.generated_data.description}</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-slate-300 font-mono whitespace-pre">{prExercise.generated_data.diff}</pre>
              </div>
            </div>

            {/* Candidate Review */}
            {prExercise.submission && (
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Candidate Review</h3>
                <p className="text-sm text-slate-400 mb-4">{prExercise.submission.summary}</p>
                <div className="space-y-3">
                  {prExercise.submission.comments.map((comment, idx) => {
                    const typeStyles = {
                      issue: 'border-red-500/30 bg-red-500/5',
                      suggestion: 'border-amber-500/30 bg-amber-500/5',
                      praise: 'border-emerald-500/30 bg-emerald-500/5',
                    };
                    const typeLabels = {
                      issue: { text: 'Issue', className: 'text-red-400' },
                      suggestion: { text: 'Suggestion', className: 'text-amber-400' },
                      praise: { text: 'Praise', className: 'text-emerald-400' },
                    };
                    return (
                      <div key={idx} className={`border rounded-lg p-3 ${typeStyles[comment.type]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold uppercase ${typeLabels[comment.type].className}`}>
                            {typeLabels[comment.type].text}
                          </span>
                          <span className="text-xs text-slate-500">
                            {comment.file}:{comment.line}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{comment.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pr_review' && !prExercise && (
          <div className="card text-center py-12">
            <p className="text-slate-500">No PR review exercise found for this candidate.</p>
          </div>
        )}

        {/* Behavioral Signals Tab */}
        {activeTab === 'behavioral' && signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {signals.map((signal, idx) => {
              const titles: Record<string, string> = {
                response_time: 'Response Time',
                question_depth: 'Question Depth',
                code_review_thoroughness: 'Code Review Thoroughness',
              };
              const icons: Record<string, string> = {
                response_time: 'from-blue-500/20 to-cyan-500/20',
                question_depth: 'from-purple-500/20 to-pink-500/20',
                code_review_thoroughness: 'from-emerald-500/20 to-teal-500/20',
              };
              return (
                <div
                  key={signal.id}
                  className={`card bg-gradient-to-br ${icons[signal.signal_type] ?? 'from-slate-500/20 to-slate-600/20'} animate-slide-up`}
                  style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
                >
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">
                    {titles[signal.signal_type] ?? signal.signal_type}
                  </h4>
                  <dl className="space-y-2">
                    {Object.entries(signal.data).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <dt className="text-slate-500">{key.replace(/_/g, ' ')}</dt>
                        <dd className="text-slate-200 font-medium">
                          {typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 0) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-slate-600 mt-3">{formatDate(signal.recorded_at)}</p>
                </div>
              );
            })}

            {/* Flags section */}
            <div className="card sm:col-span-2 lg:col-span-3">
              <h3 className="text-lg font-semibold text-slate-200 mb-3">Flags</h3>
              {signals.some((s) => {
                if (s.signal_type === 'response_time' && typeof s.data.avg_ms === 'number') return s.data.avg_ms > 8000;
                if (s.signal_type === 'code_review_thoroughness' && typeof s.data.issue_detection_rate === 'number') return s.data.issue_detection_rate < 0.3;
                return false;
              }) ? (
                <div className="space-y-2">
                  {signals.filter((s) => s.signal_type === 'response_time' && typeof s.data.avg_ms === 'number' && s.data.avg_ms > 8000).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="text-amber-400">Slow average response time ({((s.data.avg_ms as number) / 1000).toFixed(1)}s)</span>
                    </div>
                  ))}
                  {signals.filter((s) => s.signal_type === 'code_review_thoroughness' && typeof s.data.issue_detection_rate === 'number' && s.data.issue_detection_rate < 0.3).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      <span className="text-red-400">Low issue detection rate ({((s.data.issue_detection_rate as number) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No flags detected. All behavioral signals are within normal ranges.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'behavioral' && signals.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-slate-500">No behavioral signals recorded for this candidate.</p>
          </div>
        )}
      </div>
    </div>
  );
}
