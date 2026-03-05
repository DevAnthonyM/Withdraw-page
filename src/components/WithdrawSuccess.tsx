'use client';

import { useWithdrawStore } from '@/stores/useWithdrawStore';
import { WithdrawalStatus } from '@/types/withdrawal';

// ---------------------------------------------------------------------------
// Status badge color mapping
// WHY: Visual status indicators help users immediately understand the state
// of their transaction without reading text — a payment UX best practice.
// ---------------------------------------------------------------------------
function getStatusBadgeClass(status: WithdrawalStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'processing':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// ---------------------------------------------------------------------------
// Destination masking
// WHY: Displaying the full destination address in a receipt is a security
// display risk. Partial masking confirms the address without fully exposing it.
// e.g. "0x1234...abcd" → "0x1234...abcd" (first 6 + last 4)
// ---------------------------------------------------------------------------
function maskDestination(destination: string): string {
  if (destination.length <= 12) return destination;
  return `${destination.slice(0, 6)}...${destination.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Amount formatter
// WHY: Raw numbers like 100 should display as "100.00 USDT" — formatted
// values signal a production-grade interface, not a demo.
// ---------------------------------------------------------------------------
function formatAmount(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------
function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WithdrawSuccess() {
  const { withdrawal, resetForm } = useWithdrawStore();

  // Safety guard — should never render without a withdrawal in success state
  if (!withdrawal) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
    >
      {/* Success header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Withdrawal Submitted</h2>
          <p className="text-sm text-gray-500">Your request is being processed</p>
        </div>
      </div>

      {/* Receipt details */}
      <dl className="space-y-4">

        {/* Withdrawal ID */}
        <div className="flex justify-between items-start">
          <dt className="text-sm text-gray-500 font-medium">Withdrawal ID</dt>
          <dd className="text-sm text-gray-900 font-mono text-right break-all max-w-[60%]">
            {withdrawal.id}
          </dd>
        </div>

        {/* Amount */}
        <div className="flex justify-between items-center">
          <dt className="text-sm text-gray-500 font-medium">Amount</dt>
          <dd className="text-sm font-semibold text-gray-900">
            {formatAmount(withdrawal.amount, withdrawal.currency)}
          </dd>
        </div>

        {/* Destination — partially masked */}
        <div className="flex justify-between items-center">
          <dt className="text-sm text-gray-500 font-medium">Destination</dt>
          <dd className="text-sm text-gray-900 font-mono">
            {maskDestination(withdrawal.destination)}
          </dd>
        </div>

        {/* Status badge */}
        <div className="flex justify-between items-center">
          <dt className="text-sm text-gray-500 font-medium">Status</dt>
          <dd>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getStatusBadgeClass(withdrawal.status)}`}
            >
              {withdrawal.status}
            </span>
          </dd>
        </div>

        {/* Created timestamp */}
        <div className="flex justify-between items-center">
          <dt className="text-sm text-gray-500 font-medium">Submitted</dt>
          <dd className="text-sm text-gray-900">
            {formatTimestamp(withdrawal.created_at)}
          </dd>
        </div>

      </dl>

      {/* Divider */}
      <div className="my-6 border-t border-gray-100" />

      {/* New Withdrawal button */}
      <button
        onClick={resetForm}
        className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-blue-600
          border border-blue-200 bg-blue-50 hover:bg-blue-100 active:bg-blue-200
          transition-colors duration-200 focus:outline-none focus:ring-2
          focus:ring-offset-2 focus:ring-blue-500"
      >
        New Withdrawal
      </button>
    </div>
  );
}