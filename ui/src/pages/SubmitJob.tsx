import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobType } from '../types';
import { createJob } from '../mock/api';

const jobTypes: { value: JobType; label: string; description: string }[] = [
  { value: 'data-processing', label: 'Data Processing', description: 'Process and transform raw data' },
  { value: 'report-generation', label: 'Report Generation', description: 'Generate formatted reports' },
  { value: 'email-notification', label: 'Email Notification', description: 'Send email notifications' },
  { value: 'file-export', label: 'File Export', description: 'Export data to files' },
  { value: 'data-sync', label: 'Data Sync', description: 'Synchronize data between systems' },
  { value: 'image-resize', label: 'Image Resize', description: 'Resize and optimize images' },
  { value: 'pdf-generation', label: 'PDF Generation', description: 'Generate PDF documents' },
  { value: 'webhook-delivery', label: 'Webhook Delivery', description: 'Deliver webhook payloads' },
];

const samplePayloads: Record<JobType, string> = {
  'data-processing': JSON.stringify({ source: 'warehouse-db', table: 'transactions', filters: { date_range: 'last_30d' }, batch_size: 5000 }, null, 2),
  'report-generation': JSON.stringify({ report_type: 'quarterly_summary', format: 'pdf', include_charts: true, recipients: ['team@example.com'] }, null, 2),
  'email-notification': JSON.stringify({ template: 'welcome_email', to: 'user@example.com', variables: { name: 'Alice', plan: 'Pro' } }, null, 2),
  'file-export': JSON.stringify({ format: 'csv', dataset: 'user_analytics', compression: 'gzip', destination: 's3://exports/' }, null, 2),
  'data-sync': JSON.stringify({ source: 'crm', destination: 'analytics-db', entity: 'contacts', mode: 'incremental' }, null, 2),
  'image-resize': JSON.stringify({ source_url: 'https://cdn.example.com/img/hero.png', dimensions: { width: 1200, height: 630 }, quality: 85 }, null, 2),
  'pdf-generation': JSON.stringify({ template_id: 'invoice_v2', data: { invoice_number: 'INV-2024-001', amount: 2450.00 } }, null, 2),
  'webhook-delivery': JSON.stringify({ url: 'https://hooks.example.com/events', event: 'order.completed', retry_count: 3 }, null, 2),
};

export default function SubmitJob() {
  const navigate = useNavigate();
  const [jobType, setJobType] = useState<JobType>('data-processing');
  const [payload, setPayload] = useState(samplePayloads['data-processing']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTypeChange = (type: JobType) => {
    setJobType(type);
    setPayload(samplePayloads[type]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate JSON
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Invalid JSON payload. Please check the syntax.');
      return;
    }

    setSubmitting(true);
    try {
      const job = await createJob({ type: jobType, payload: parsedPayload });
      setSuccess(true);
      setTimeout(() => {
        navigate(`/jobs/${job.id}`);
      }, 1200);
    } catch {
      setError('Failed to submit job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Submit Job</h1>
        <p className="text-slate-400 mt-1">Create a new job to be processed by the pipeline.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Type Selection */}
        <div className="card">
          <label className="block text-sm font-semibold text-slate-200 mb-4">
            Job Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {jobTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                  jobType === type.value
                    ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                }`}
              >
                <p className={`text-sm font-medium ${jobType === type.value ? 'text-indigo-300' : 'text-slate-300'}`}>
                  {type.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Payload Editor */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-semibold text-slate-200">
              JSON Payload
            </label>
            <button
              type="button"
              onClick={() => setPayload(samplePayloads[jobType])}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Reset to sample
            </button>
          </div>
          <div className="relative">
            <textarea
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                setError(null);
              }}
              rows={12}
              className="input-field w-full font-mono text-sm resize-none leading-relaxed"
              spellCheck={false}
              placeholder='{"key": "value"}'
            />
            <div className="absolute top-3 right-3 text-[10px] text-slate-600 uppercase tracking-wider font-medium bg-slate-900/90 px-2 py-0.5 rounded">
              JSON
            </div>
          </div>
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 animate-slide-up">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Job submitted successfully! Redirecting...
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting || success}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : success ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Submitted
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Submit Job
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
