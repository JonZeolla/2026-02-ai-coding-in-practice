import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { JobStats, Job } from '../types';
import { fetchJobStats, fetchJobs } from '../mock/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

const statCards = [
  {
    key: 'pending' as const,
    label: 'Pending',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    gradient: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  {
    key: 'processing' as const,
    label: 'Processing',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
      </svg>
    ),
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    key: 'completed' as const,
    label: 'Completed',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    gradient: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    key: 'failed' as const,
    label: 'Failed',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    gradient: 'from-red-500/20 to-rose-500/20',
    border: 'border-red-500/20',
    text: 'text-red-400',
    iconBg: 'bg-red-500/10',
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [statsData, jobsData] = await Promise.all([fetchJobStats(), fetchJobs()]);
      setStats(statsData);
      setRecentJobs(jobsData.slice(0, 5));
      setLoading(false);
    };
    load();

    const interval = setInterval(async () => {
      const [statsData, jobsData] = await Promise.all([fetchJobStats(), fetchJobs()]);
      setStats(statsData);
      setRecentJobs(jobsData.slice(0, 5));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Monitor your job pipeline at a glance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card, idx) => (
          <div
            key={card.key}
            className={`card card-hover bg-gradient-to-br ${card.gradient} border ${card.border} animate-slide-up`}
            style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">{card.label}</p>
                <p className={`text-4xl font-bold mt-2 ${card.text}`}>
                  {stats ? stats[card.key] : 0}
                </p>
              </div>
              <div className={`${card.iconBg} ${card.text} p-2.5 rounded-lg`}>
                {card.icon}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/50">
              <p className="text-xs text-slate-500">
                {stats ? ((stats[card.key] / (stats.total || 1)) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Total Jobs & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <div className="card lg:col-span-1">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Total Jobs</span>
              <span className="text-2xl font-bold text-indigo-400">{stats?.total ?? 0}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              {stats && stats.total > 0 && (
                <div className="flex h-full">
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${(stats.processing / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-400">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-400">Processing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-400">Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-slate-400">Failed</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <Link to="/submit" className="btn-primary w-full flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Submit New Job
            </Link>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Recent Jobs</h3>
            <Link to="/jobs" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {recentJobs.map((job, idx) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-200 group animate-slide-in-right"
                style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-xs text-slate-500 font-mono truncate">{job.id}</code>
                  <span className="text-sm text-slate-300 font-medium">{job.type}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={job.status} />
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
