import { WithdrawRequest, Withdrawal, ApiError } from '@/types/withdrawal';
import { submitWithdrawalMock, getWithdrawalMock } from './mockApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff (ms)

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable.
 * WHY: We only retry transient failures (network errors, 5xx).
 * We NEVER retry 4xx — those are client errors that won't resolve on retry.
 */
function isRetryable(status?: number): boolean {
  if (status === undefined) return true; // Network error — no HTTP status
  return status >= 500;
}

/**
 * Maps an HTTP response or thrown error into a typed ApiError.
 * WHY: Components and the store should never deal with raw HTTP details.
 * All error translation happens here, at the API boundary.
 */
function buildApiError(status: number, message: string): ApiError {
  return {
    status,
    message,
    isConflict: status === 409,
    isRetryable: isRetryable(status),
  };
}

// --- Core API Functions ---

/**
 * POST /v1/withdrawals
 * Submits a new withdrawal request.
 *
 * WHY idempotency_key is in the payload:
 * The same key must be sent on retries so the server can detect duplicates
 * and return the original response rather than processing a second charge.
 * This mirrors the strategy used in Stripe's and M-Pesa's APIs.
 */
export async function submitWithdrawal(request: WithdrawRequest): Promise<Withdrawal> {
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait before retrying (skip delay on first attempt)
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      let response: Response;

      // If a real API URL is set, call it. Otherwise use the mock.
      if (process.env.NEXT_PUBLIC_API_URL) {
        response = await fetch(`${API_BASE}/withdrawals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
      } else {
        // Use mock — returns a real Response object
        response = await submitWithdrawalMock(request);
      }

      // --- 409 Conflict: already submitted, do NOT retry ---
      if (response.status === 409) {
        return Promise.reject(
          buildApiError(
            409,
            "This withdrawal request has already been submitted. Please check your withdrawal history."
          )
        );
      }

      // --- Other 4xx: client error, do NOT retry ---
      if (response.status >= 400 && response.status < 500) {
        const body = await response.json().catch(() => ({}));
        return Promise.reject(
          buildApiError(response.status, body?.message || 'Invalid request. Please check your details.')
        );
      }

      // --- 5xx: server error, retryable ---
      if (response.status >= 500) {
        const body = await response.json().catch(() => ({}));
        lastError = buildApiError(
          response.status,
          body?.message || 'A server error occurred. Retrying...'
        );
        continue; // Retry
      }

      // --- Success (200/201) ---
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();

        // Validate response shape — never trust the API blindly
        if (!data.id || !data.amount || !data.destination || !data.status) {
          return Promise.reject(
            buildApiError(0, 'Received an unexpected response from the server.')
          );
        }

        return data as Withdrawal;
      }

      // --- Unexpected status ---
      lastError = buildApiError(response.status, 'An unexpected error occurred.');
      continue;

    } catch (_err) {
      // Network error (TypeError from fetch) — retryable
      // WHY: fetch throws TypeError on network failure (no internet, DNS failure, etc.)
      // We retry these because they are transient and not caused by our request data.
      console.error(_err);
      lastError = {
        status: 0,
        message: 'A network error occurred. Your data has been saved — you can retry safely.',
        isConflict: false,
        isRetryable: true,
      };
      continue;
    }
  }

  // All retries exhausted
  return Promise.reject(
    lastError ?? buildApiError(0, 'Request failed after multiple attempts. Please try again.')
  );
}

/**
 * GET /v1/withdrawals/{id}
 * Fetches a single withdrawal by ID.
 *
 * WHY this exists: After a successful POST, the server may return 'pending'.
 * This endpoint is used to poll or fetch the latest status of a withdrawal.
 */
export async function getWithdrawal(id: string): Promise<Withdrawal> {
  try {
    let response: Response;

    if (process.env.NEXT_PUBLIC_API_URL) {
      response = await fetch(`${API_BASE}/withdrawals/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      response = await getWithdrawalMock(id);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return Promise.reject(
        buildApiError(response.status, body?.message || 'Failed to fetch withdrawal details.')
      );
    }

    const data = await response.json();

    // Validate response shape
    if (!data.id || !data.amount || !data.destination || !data.status) {
      return Promise.reject(
        buildApiError(0, 'Received an unexpected response from the server.')
      );
    }

    return data as Withdrawal;

  } catch {
    return Promise.reject(
      buildApiError(0, 'A network error occurred while fetching withdrawal details.')
    );
  }
}