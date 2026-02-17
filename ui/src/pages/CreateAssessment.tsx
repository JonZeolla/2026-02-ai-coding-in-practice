import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAssessment } from '../mock/api';

const SUGGESTED_TECH = [
  'TypeScript', 'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python',
  'Go', 'Rust', 'Java', 'C#', 'Ruby', 'PostgreSQL', 'MySQL', 'MongoDB',
  'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform',
  'GraphQL', 'gRPC', 'Kafka', 'RabbitMQ',
];

export default function CreateAssessment() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [techInput, setTechInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const addTech = useCallback((tech: string) => {
    const trimmed = tech.trim();
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack((prev) => [...prev, trimmed]);
    }
    setTechInput('');
  }, [techStack]);

  const removeTech = useCallback((tech: string) => {
    setTechStack((prev) => prev.filter((t) => t !== tech));
  }, []);

  const handleTechKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTech(techInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!role.trim()) {
      setError('Role is required');
      return;
    }

    setSubmitting(true);
    try {
      const assessment = await createAssessment({
        title: title.trim(),
        role: role.trim(),
        description: description.trim() || undefined,
        tech_stack: techStack,
        job_description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/assessments/${assessment.id}`), 1200);
    } catch {
      setError('Failed to create assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuggestions = SUGGESTED_TECH.filter(
    (t) => !techStack.includes(t) && t.toLowerCase().includes(techInput.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Create Assessment</h1>
        <p className="text-slate-400 mt-1">Set up a new hiring assessment for candidates.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="card">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Assessment Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            className="input-field w-full"
          />
        </div>

        {/* Role */}
        <div className="card">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Role <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            className="input-field w-full"
          />
        </div>

        {/* Job Description */}
        <div className="card">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Job Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role, responsibilities, and what you're looking for in a candidate..."
            rows={6}
            className="input-field w-full resize-none"
          />
          <p className="text-xs text-slate-500 mt-2">
            The job description helps generate tailored interview questions and PR review exercises.
          </p>
        </div>

        {/* Tech Stack */}
        <div className="card">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Tech Stack
          </label>
          <div className="space-y-3">
            {/* Selected tags */}
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-full text-sm font-medium"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTech(tech)}
                      className="hover:text-indigo-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input */}
            <input
              type="text"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={handleTechKeyDown}
              placeholder="Type a technology and press Enter..."
              className="input-field w-full"
            />

            {/* Suggestions */}
            {techInput && filteredSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filteredSuggestions.map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => addTech(tech)}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-400 rounded-md hover:bg-slate-700 hover:text-slate-200 transition-all duration-200"
                  >
                    + {tech}
                  </button>
                ))}
              </div>
            )}

            {!techInput && techStack.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                <p className="text-xs text-slate-500 w-full mb-1">Suggestions:</p>
                {SUGGESTED_TECH.slice(0, 12).map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => addTech(tech)}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-800/50 text-slate-500 rounded-md hover:bg-slate-700 hover:text-slate-300 transition-all duration-200"
                  >
                    + {tech}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-emerald-400">Assessment created! Redirecting...</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || success}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : success ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Created
              </>
            ) : (
              'Create Assessment'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/assessments')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
