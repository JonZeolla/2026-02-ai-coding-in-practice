import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import InterviewView from '../components/candidate/InterviewView';
import PRReviewView from '../components/candidate/PRReviewView';
import CompletionView from '../components/candidate/CompletionView';
import Spinner from '../components/Spinner';
import { useBehavioralTracking } from '../hooks/useBehavioralTracking';

type PortalPhase = 'loading' | 'interview' | 'pr-review' | 'complete' | 'error';

interface SessionData {
  candidate: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  assessment: {
    id: string;
    title: string;
    description: string;
    role: string;
  };
}

export default function CandidatePortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [phase, setPhase] = useState<PortalPhase>('loading');
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { trackResponseStart, trackResponseEnd } = useBehavioralTracking({
    token,
    enabled: !!token,
  });

  const determinePhase = useCallback((candidateStatus: string): PortalPhase => {
    switch (candidateStatus) {
      case 'invited':
      case 'interviewing':
        return 'interview';
      case 'interview_complete':
      case 'pr_review':
        return 'pr-review';
      case 'pr_review_complete':
      case 'completed':
        return 'complete';
      default:
        return 'interview';
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Missing access token. Please use the link provided in your invitation email.');
      setPhase('error');
      return;
    }

    async function loadSession() {
      try {
        const res = await fetch('/api/candidate/session', {
          headers: { 'x-candidate-token': token },
        });

        if (!res.ok) {
          if (res.status === 401) {
            setError('Invalid or expired access token.');
          } else {
            setError('Failed to load your session. Please try again.');
          }
          setPhase('error');
          return;
        }

        const data: SessionData = await res.json();
        setSession(data);
        setPhase(determinePhase(data.candidate.status));
      } catch {
        setError('Unable to connect to the server. Please check your connection.');
        setPhase('error');
      }
    }

    loadSession();
  }, [token, determinePhase]);

  const handleInterviewComplete = useCallback(() => {
    setPhase('pr-review');
  }, []);

  const handlePRReviewComplete = useCallback(() => {
    setPhase('complete');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-semibold text-slate-200">
              {session?.assessment.title || 'Technical Assessment'}
            </span>
          </div>
          {session && (
            <span className="text-sm text-slate-400">
              {session.candidate.name}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {phase === 'loading' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="text-slate-400 mt-4">Loading your assessment...</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card max-w-md w-full text-center py-10 px-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Access Error</h2>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {phase === 'interview' && session && (
          <InterviewView
            token={token}
            onComplete={handleInterviewComplete}
            trackResponseStart={trackResponseStart}
            trackResponseEnd={trackResponseEnd}
          />
        )}

        {phase === 'pr-review' && session && (
          <PRReviewView
            token={token}
            onComplete={handlePRReviewComplete}
          />
        )}

        {phase === 'complete' && session && (
          <CompletionView candidateName={session.candidate.name} />
        )}
      </main>
    </div>
  );
}
