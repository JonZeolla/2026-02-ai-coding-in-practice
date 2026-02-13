import { JobStatus } from '../types';

interface StatusBadgeProps {
  status: JobStatus;
}

const statusConfig: Record<JobStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: 'Pending',
    className: 'badge badge-pending',
    dot: 'bg-amber-400',
  },
  processing: {
    label: 'Processing',
    className: 'badge badge-processing',
    dot: 'bg-blue-400 animate-pulse',
  },
  completed: {
    label: 'Completed',
    className: 'badge badge-completed',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    className: 'badge badge-failed',
    dot: 'bg-red-400',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={config.className}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}></span>
      {config.label}
    </span>
  );
}
