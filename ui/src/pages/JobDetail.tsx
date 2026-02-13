import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Job } from '../types';
import { fetchJob } from '../mock/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatType(type: string): string {
  return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const data = await fetchJob(id);
      if (!data) {
        setNotFound(true);
      } else {
        setJob(data);
      }
      setLoading(false);
    };
    load();

    const interval = setInterval(async () => {
      const data = await fetchJob(id);
      if (data) setJob(data);
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
        <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <h2 className="text-xl font-semibold text-slate-300 mb-2">Job Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">The job with ID "{id}" could not be found.</p>
        <button onClick={() => navigate('/jobs')} className="btn-primary">
          Back to Jobs
        </button>
      </div>
    );
  }

  const timelineEvents = [
    { label: 'Created', time: job.createdAt, icon: 'create' },
    ...(job.updatedAt !== job.createdAt ? [{ label: 'Updated', time: job.updatedAt, icon: 'update' }] : []),
    ...(job.completedAt ? [{ label: 'Completed', time: job.completedAt, icon: 'complete' }] : []),
  ];

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/jobs" className="hover:text-slate-300 transition-colors">Jobs</Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-slate-300 font-mono">{job.id}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-100">{formatType(job.type)}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-slate-500 font-mono">{job.id}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/jobs')} className="btn-secondary text-sm">
            <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payload */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
              Payload
            </h3>
            <pre className="bg-slate-950/50 border border-slate-800/50 rounded-lg p-4 text-sm text-slate-300 font-mono overflow-x-auto leading-relaxed">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {job.result && (
            <div className="card animate-slide-up">
              <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Result
              </h3>
              <pre className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-4 text-sm text-emerald-200 font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {job.error && (
            <div className="card animate-slide-up border-red-500/20">
              <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Error
              </h3>
              <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
                <p className="text-sm text-red-300 font-mono">{job.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Details */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Status</dt>
                <dd><StatusBadge status={job.status} /></dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Job Type</dt>
                <dd className="text-sm text-slate-200">{formatType(job.type)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Job ID</dt>
                <dd className="text-sm text-slate-400 font-mono break-all">{job.id}</dd>
              </div>
            </dl>
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Timeline</h3>
            <div className="space-y-0">
              {timelineEvents.map((event, idx) => (
                <div key={event.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1 ${
                        event.icon === 'complete'
                          ? 'bg-emerald-500'
                          : event.icon === 'update'
                            ? 'bg-blue-500'
                            : 'bg-slate-500'
                      }`}
                    />
                    {idx < timelineEvents.length - 1 && (
                      <div className="w-px flex-1 bg-slate-800 my-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm text-slate-200 font-medium">{event.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(event.time)}</p>
                    <p className="text-[10px] text-slate-600">{timeSince(event.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
