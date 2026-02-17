import { useState, useEffect, useCallback } from 'react';
import Spinner from '../Spinner';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber: number;
}

interface PRFile {
  path: string;
  diff: string;
}

interface PRComment {
  id: string;
  file: string;
  line: number;
  comment: string;
  createdAt: string;
}

interface PRData {
  title: string;
  description: string;
  files: PRFile[];
}

interface PRReviewViewProps {
  token: string;
  onComplete: () => void;
}

function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split('\n');
  const result: DiffLine[] = [];
  let lineNum = 0;

  for (const raw of lines) {
    lineNum++;
    if (raw.startsWith('+')) {
      result.push({ type: 'add', content: raw.slice(1), lineNumber: lineNum });
    } else if (raw.startsWith('-')) {
      result.push({ type: 'remove', content: raw.slice(1), lineNumber: lineNum });
    } else {
      result.push({ type: 'context', content: raw.startsWith(' ') ? raw.slice(1) : raw, lineNumber: lineNum });
    }
  }
  return result;
}

function DiffViewer({
  file,
  comments,
  onLineClick,
}: {
  file: PRFile;
  comments: PRComment[];
  onLineClick: (file: string, line: number) => void;
}) {
  const lines = parseDiff(file.diff);
  const fileComments = comments.filter((c) => c.file === file.path);

  return (
    <div className="border border-slate-800/50 rounded-lg overflow-hidden">
      <div className="bg-slate-800/60 px-4 py-2 text-sm font-mono text-slate-300 border-b border-slate-800/50">
        {file.path}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <tbody>
            {lines.map((line) => {
              const lineComments = fileComments.filter((c) => c.line === line.lineNumber);
              return (
                <tr key={line.lineNumber} className="group">
                  <td
                    className={`w-12 text-right pr-3 pl-2 select-none text-xs cursor-pointer
                      ${line.type === 'add' ? 'bg-emerald-500/10 text-emerald-600' : ''}
                      ${line.type === 'remove' ? 'bg-red-500/10 text-red-600' : ''}
                      ${line.type === 'context' ? 'text-slate-600' : ''}
                      group-hover:bg-indigo-500/10 group-hover:text-indigo-400`}
                    onClick={() => onLineClick(file.path, line.lineNumber)}
                    title="Click to comment"
                  >
                    {line.lineNumber}
                  </td>
                  <td className="w-5 text-center select-none">
                    {line.type === 'add' && <span className="text-emerald-400">+</span>}
                    {line.type === 'remove' && <span className="text-red-400">-</span>}
                  </td>
                  <td
                    className={`px-3 py-0.5 whitespace-pre
                      ${line.type === 'add' ? 'bg-emerald-500/5 text-emerald-200' : ''}
                      ${line.type === 'remove' ? 'bg-red-500/5 text-red-200' : ''}
                      ${line.type === 'context' ? 'text-slate-400' : ''}`}
                  >
                    {line.content || '\u00A0'}
                    {lineComments.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {lineComments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-indigo-500/10 border border-indigo-500/20 rounded px-3 py-2 text-xs text-indigo-300 font-sans"
                          >
                            {c.comment}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PRReviewView({ token, onComplete }: PRReviewViewProps) {
  const [prData, setPrData] = useState<PRData | null>(null);
  const [comments, setComments] = useState<PRComment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment form state
  const [commentTarget, setCommentTarget] = useState<{ file: string; line: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    'x-candidate-token': token,
  };

  const loadPR = useCallback(async () => {
    try {
      const res = await fetch('/api/candidate/pr-review', {
        headers: { 'x-candidate-token': token },
      });
      const data = await res.json();

      if (data.status === 'submitted') {
        onComplete();
        return;
      }

      if (data.status === 'generating') {
        // Poll until ready
        setTimeout(loadPR, 3000);
        return;
      }

      if (data.pr) {
        setPrData(data.pr as PRData);
        if (data.pr.files?.length > 0) {
          setSelectedFile(data.pr.files[0].path);
        }
        if (data.submission?.comments) {
          setComments(data.submission.comments);
        }
      }
      setLoading(false);
    } catch {
      setError('Failed to load PR data');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onComplete]);

  useEffect(() => {
    // Start exercise or load existing
    async function init() {
      try {
        await fetch('/api/candidate/pr-review/start', {
          method: 'POST',
          headers,
        });
      } catch {
        // May fail if already started - that's fine
      }
      loadPR();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLineClick = (file: string, line: number) => {
    setCommentTarget({ file, line });
    setCommentText('');
  };

  const handleAddComment = async () => {
    if (!commentTarget || !commentText.trim()) return;
    setAddingComment(true);
    setError(null);

    try {
      const res = await fetch('/api/candidate/pr-review/comment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file: commentTarget.file,
          line: commentTarget.line,
          comment: commentText.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to add comment');
        setAddingComment(false);
        return;
      }

      const data = await res.json();
      setComments((prev) => [
        ...prev,
        {
          id: data.commentId,
          file: commentTarget.file,
          line: commentTarget.line,
          comment: commentText.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      setCommentTarget(null);
      setCommentText('');
      setAddingComment(false);
    } catch {
      setError('Failed to add comment');
      setAddingComment(false);
    }
  };

  const handleSubmitReview = async () => {
    if (comments.length === 0) {
      setError('Add at least one comment before submitting');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/candidate/pr-review/submit', {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to submit review');
        setSubmitting(false);
        return;
      }

      onComplete();
    } catch {
      setError('Failed to submit review');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-slate-400 mt-4">
            {prData === null ? 'Generating PR for review...' : 'Loading...'}
          </p>
          <p className="text-slate-500 text-sm mt-1">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!prData) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load PR data. Please refresh the page.</p>
      </div>
    );
  }

  const currentFile = prData.files.find((f) => f.path === selectedFile);

  return (
    <div className="animate-fade-in">
      {/* PR Header */}
      <div className="card mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-1">{prData.title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{prData.description}</p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <span className="text-sm text-slate-500">
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSubmitReview}
              disabled={submitting || comments.length === 0}
              className="btn-primary text-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/15 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        {/* File tree */}
        <div className="w-64 shrink-0">
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
              Files Changed
            </h3>
            <div className="space-y-0.5">
              {prData.files.map((file) => {
                const fileCommentCount = comments.filter((c) => c.file === file.path).length;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono truncate flex items-center justify-between gap-2
                      ${selectedFile === file.path
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                  >
                    <span className="truncate">{file.path.split('/').pop()}</span>
                    {fileCommentCount > 0 && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                        {fileCommentCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Diff viewer */}
        <div className="flex-1 min-w-0">
          {currentFile && (
            <DiffViewer
              file={currentFile}
              comments={comments}
              onLineClick={handleLineClick}
            />
          )}
        </div>
      </div>

      {/* Comment form modal */}
      {commentTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Add Comment
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {commentTarget.file} : line {commentTarget.line}
            </p>
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write your review comment..."
              rows={4}
              className="input-field w-full resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCommentTarget(null)}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || addingComment}
                className="btn-primary text-sm py-1.5 px-3"
              >
                {addingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
