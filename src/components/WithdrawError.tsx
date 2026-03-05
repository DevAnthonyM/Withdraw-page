'use client';

import { useWithdrawStore } from '@/stores/useWithdrawStore';
import { ApiError } from '@/types/withdrawal';

// ---------------------------------------------------------------------------
// Error message mapping
// WHY: Components must never show raw HTTP errors to users.
// Every error case is mapped to a human-readable, actionable message.
// ---------------------------------------------------------------------------
export function getErrorMessage(error: ApiError): string {
  if (error.isConflict) {
    return "This withdrawal has already been submitted. If you don't see it in your history, please wait a moment and refresh.";
  }
  if (error.isRetryable) {
    return 'A temporary error occurred. Your data has been saved — you can retry safely.';
  }
  return error.message || 'An unexpected error occurred. Please try again.';
}

export default function WithdrawError() {
  const { error, retrySubmission } = useWithdrawStore();

  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
    >
      <p className="text-sm font-medium text-red-800">
        {getErrorMessage(error)}
      </p>
      {error.isRetryable && (
        <button
          onClick={retrySubmission}
          className="mt-3 text-sm font-semibold text-red-700 underline hover:text-red-900
            focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        >
          Retry withdrawal
        </button>
      )}
    </div>
  );
}