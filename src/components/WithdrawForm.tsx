'use client';

import { useState } from 'react';
import { useWithdrawStore } from '@/stores/useWithdrawStore';
import { validateWithdrawForm } from '@/lib/validators';
import { ApiError } from '@/types/withdrawal';

// ---------------------------------------------------------------------------
// Error message mapping
// WHY: Components must never show raw HTTP errors to users.
// Every error case is mapped to a human-readable, actionable message.
// ---------------------------------------------------------------------------
function getErrorMessage(error: ApiError): string {
  if (error.isConflict) {
    return "This withdrawal has already been submitted. If you don't see it in your history, please wait a moment and refresh.";
  }
  if (error.isRetryable) {
    return 'A temporary error occurred. Your data has been saved — you can retry safely.';
  }
  return error.message || 'An unexpected error occurred. Please try again.';
}

export default function WithdrawForm() {
  const {
    formData,
    status,
    error,
    setFormField,
    submitWithdrawal,
    retrySubmission,
  } = useWithdrawStore();

  // Track which fields have been blurred — show errors only after blur (UX best practice)
  // WHY: Showing errors on every keystroke frustrates users before they finish typing.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validation = validateWithdrawForm(formData);
  const isLoading = status === 'loading';
  const isSubmitDisabled = !validation.isValid || isLoading;

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit() {
    // Mark all fields as touched so all errors are visible on submit attempt
    setTouched({ amount: true, destination: true, confirmed: true });
    if (!validation.isValid || isLoading) return;
    await submitWithdrawal();
  }

  async function handleRetry() {
    await retrySubmission();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

      {/* ------------------------------------------------------------------ */}
      {/* Error Banner — shown when status === 'error'                        */}
      {/* Form values remain intact so user can retry without re-entering     */}
      {/* ------------------------------------------------------------------ */}
      {status === 'error' && error && (
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
              onClick={handleRetry}
              className="mt-3 text-sm font-semibold text-red-700 underline hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            >
              Retry withdrawal
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Amount Field                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-5">
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Amount (USDT)
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          value={formData.amount}
          disabled={isLoading}
          onChange={(e) => setFormField('amount', e.target.value)}
          onBlur={() => handleBlur('amount')}
          placeholder="e.g. 100.00"
          aria-describedby={touched.amount && validation.errors.amount ? 'amount-error' : undefined}
          aria-invalid={!!(touched.amount && validation.errors.amount)}
          className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${touched.amount && validation.errors.amount
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-white'
            }`}
        />
        {touched.amount && validation.errors.amount && (
          <p id="amount-error" role="alert" className="mt-1 text-xs text-red-600">
            {validation.errors.amount}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Destination Field                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-5">
        <label
          htmlFor="destination"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Destination Address
        </label>
        <input
          id="destination"
          type="text"
          value={formData.destination}
          disabled={isLoading}
          onChange={(e) => setFormField('destination', e.target.value)}
          onBlur={() => handleBlur('destination')}
          placeholder="e.g. 0x1234...abcd"
          aria-describedby={touched.destination && validation.errors.destination ? 'destination-error' : undefined}
          aria-invalid={!!(touched.destination && validation.errors.destination)}
          className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${touched.destination && validation.errors.destination
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-white'
            }`}
        />
        {touched.destination && validation.errors.destination && (
          <p id="destination-error" role="alert" className="mt-1 text-xs text-red-600">
            {validation.errors.destination}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Confirm Checkbox                                                    */}
      {/* WHY: Explicit user confirmation is a UX safety net for financial    */}
      {/* transactions — prevents accidental submissions.                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="confirmed"
            type="checkbox"
            checked={formData.confirmed}
            disabled={isLoading}
            onChange={(e) => {
              setFormField('confirmed', e.target.checked);
              handleBlur('confirmed');
            }}
            aria-describedby={touched.confirmed && validation.errors.confirmed ? 'confirmed-error' : undefined}
            aria-invalid={!!(touched.confirmed && validation.errors.confirmed)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500
              disabled:cursor-not-allowed"
          />
          <span className="text-sm text-gray-700">
            I confirm this withdrawal is correct and understand it cannot be reversed.
          </span>
        </label>
        {touched.confirmed && validation.errors.confirmed && (
          <p id="confirmed-error" role="alert" className="mt-1 text-xs text-red-600">
            {validation.errors.confirmed}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit Button                                                       */}
      {/* LAYER 1 DOUBLE-SUBMIT PROTECTION (UI Layer):                        */}
      {/* Button is disabled whenever form is invalid OR status is 'loading'. */}
      {/* This is the first line of defence against duplicate submissions.    */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        aria-disabled={isSubmitDisabled}
        aria-busy={isLoading}
        className={`w-full py-3 px-4 rounded-lg text-sm font-semibold text-white
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          focus:ring-blue-500
          ${isSubmitDisabled
            ? 'bg-blue-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            {/* Spinner — visual indicator that request is in flight */}
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Submit Withdrawal'
        )}
      </button>
    </div>
  );
}