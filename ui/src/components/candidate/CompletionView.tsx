interface CompletionViewProps {
  candidateName: string;
}

export default function CompletionView({ candidateName }: CompletionViewProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="card max-w-lg w-full text-center py-12 px-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-3">
          Thank You, {candidateName}!
        </h1>

        <p className="text-slate-400 mb-6 leading-relaxed">
          Your assessment has been submitted successfully. Our team will review
          your responses and get back to you soon.
        </p>

        <div className="border-t border-slate-800/50 pt-6">
          <p className="text-sm text-slate-500">
            You may now close this window.
          </p>
        </div>
      </div>
    </div>
  );
}
