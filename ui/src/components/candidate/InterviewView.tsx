import { useState, useEffect, useRef, useCallback } from 'react';
import Spinner from '../Spinner';

interface ConversationMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  questionNumber?: number;
  timestamp: string;
}

interface InterviewViewProps {
  token: string;
  onComplete: () => void;
  trackResponseStart: (questionNumber: number) => void;
  trackResponseEnd: (questionNumber: number) => void;
}

export default function InterviewView({
  token,
  onComplete,
  trackResponseStart,
  trackResponseEnd,
}: InterviewViewProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions] = useState(8);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const headers = {
    'Content-Type': 'application/json',
    'x-candidate-token': token,
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Initialize interview
  useEffect(() => {
    async function init() {
      try {
        // Check for existing session
        const statusRes = await fetch('/api/candidate/interview/status', { headers });
        const statusData = await statusRes.json();

        if (statusData.hasSession && statusData.status === 'completed') {
          onComplete();
          return;
        }

        if (statusData.hasSession && statusData.status === 'in_progress') {
          setQuestionNumber(statusData.questionNumber);
          if (statusData.startedAt) {
            setStartTime(new Date(statusData.startedAt).getTime());
          }
          if (statusData.currentQuestion) {
            setMessages([
              {
                role: 'interviewer',
                content: statusData.currentQuestion,
                questionNumber: statusData.questionNumber,
                timestamp: new Date().toISOString(),
              },
            ]);
            trackResponseStart(statusData.questionNumber);
          }
          setLoading(false);
          return;
        }

        // Start new interview
        const startRes = await fetch('/api/candidate/interview/start', {
          method: 'POST',
          headers,
        });

        if (!startRes.ok) {
          const err = await startRes.json();
          setError(err.error || 'Failed to start interview');
          setLoading(false);
          return;
        }

        const startData = await startRes.json();
        setQuestionNumber(startData.questionNumber);
        setStartTime(Date.now());
        setMessages([
          {
            role: 'interviewer',
            content: startData.question,
            questionNumber: startData.questionNumber,
            timestamp: new Date().toISOString(),
          },
        ]);
        trackResponseStart(startData.questionNumber);
        setLoading(false);
      } catch {
        setError('Failed to connect to the server');
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;

    const trimmedAnswer = answer.trim();
    trackResponseEnd(questionNumber);
    setSubmitting(true);
    setError(null);

    // Add candidate message
    const candidateMsg: ConversationMessage = {
      role: 'candidate',
      content: trimmedAnswer,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, candidateMsg]);
    setAnswer('');

    try {
      const res = await fetch('/api/candidate/interview/answer', {
        method: 'POST',
        headers,
        body: JSON.stringify({ answer: trimmedAnswer }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to submit answer');
        setSubmitting(false);
        return;
      }

      const data = await res.json();

      if (data.status === 'completed') {
        onComplete();
        return;
      }

      setQuestionNumber(data.questionNumber);
      setMessages((prev) => [
        ...prev,
        {
          role: 'interviewer',
          content: data.question,
          questionNumber: data.questionNumber,
          timestamp: new Date().toISOString(),
        },
      ]);
      trackResponseStart(data.questionNumber);
      setSubmitting(false);
      textareaRef.current?.focus();
    } catch {
      setError('Failed to submit answer. Please try again.');
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-slate-400 mt-4">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-100">Technical Interview</h2>
          <span className="badge badge-processing">Live</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(elapsedSeconds)}
          </div>
          <div>
            Question {questionNumber} of {totalQuestions}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 ${
                msg.role === 'interviewer'
                  ? 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
                  : 'bg-indigo-600/80 text-white'
              }`}
            >
              {msg.role === 'interviewer' && msg.questionNumber && (
                <div className="text-xs text-slate-500 mb-1.5 font-medium">
                  Question {msg.questionNumber}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {submitting && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Spinner size="sm" />
                Generating next question...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-4 py-2 bg-red-500/15 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-800/50 pt-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={submitting}
            rows={3}
            className="input-field w-full resize-none pr-20"
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitting}
            className="absolute right-2 bottom-2 btn-primary py-1.5 px-3 text-sm"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Press Cmd+Enter or Ctrl+Enter to send
        </p>
      </div>
    </div>
  );
}
