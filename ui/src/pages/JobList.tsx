import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Job, JobStatus } from '../types';
import { fetchJobs } from '../mock/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatType(type: string): string {
  return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadJobs = useCallback(async () => {
    const data = await fetchJobs();
    setJobs(data);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadJobs]);

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus !== 'all' && job.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return job.id.toLowerCase().includes(q) || job.type.toLowerCase().includes(q);
    }
    return true;
  });

  const statusCounts = jobs.reduce(
    (acc, j) => {
      acc[j.status]++;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 } as Record<JobStatus, number>,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Jobs</h1>
          <p className="text-slate-400 mt-1">
            {filteredJobs.length} of {jobs.length} jobs
            {autoRefresh && (
              <span className="text-slate-500 text-xs ml-2">
                &middot; Auto-refreshing &middot; Updated {formatDate(lastRefresh.toISOString())}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn-secondary flex items-center gap-2 text-sm ${autoRefresh ? 'border-emerald-500/30 text-emerald-400' : ''}`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <Link to="/submit" className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Job
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map((status) => {
              const isActive = filterStatus === status;
              const count = status === 'all' ? jobs.length : statusCounts[status];
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500/20' : 'bg-slate-700/50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Job Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Job ID
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Created
                </th>
                <th className="px-6 py-3.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {filteredJobs.map((job, idx) => (
                <tr
                  key={job.id}
                  className="group hover:bg-slate-800/30 transition-colors duration-150 animate-slide-up"
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}
                >
                  <td className="px-6 py-3.5">
                    <code className="text-xs text-slate-400 font-mono">{job.id}</code>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-sm text-slate-200 font-medium">{formatType(job.type)}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-sm text-slate-400">{formatDate(job.createdAt)}</span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium"
                    >
                      Details
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJobs.length === 0 && (
          <div className="px-6 py-16 text-center">
            <svg className="w-12 h-12 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            <p className="text-sm text-slate-500">No jobs match your filters.</p>
            <button
              onClick={() => {
                setFilterStatus('all');
                setSearchQuery('');
              }}
              className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
