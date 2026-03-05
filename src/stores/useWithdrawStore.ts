import { create } from 'zustand';
import {
  WithdrawFormData,
  WithdrawFormState,
  Withdrawal,
  ApiError,
} from '@/types/withdrawal';
import { submitWithdrawal, getWithdrawal } from '@/services/withdrawalApi';
import { generateIdempotencyKey } from '@/lib/idempotency';

// ---------------------------------------------------------------------------
// State Interface
// ---------------------------------------------------------------------------

interface WithdrawState {
  // Form state
  formData: WithdrawFormData;

  // UI state machine — 'idle' | 'loading' | 'success' | 'error'
  // WHY explicit state machine: prevents impossible UI combinations
  // (e.g., showing success AND error simultaneously is structurally impossible)
  status: WithdrawFormState;

  // Results
  withdrawal: Withdrawal | null;
  error: ApiError | null;

  // Idempotency
  // WHY stored in state: retrySubmission must reuse the SAME key that was
  // generated for the original attempt. A new key would be treated as a
  // new withdrawal by the server — that defeats the entire purpose.
  currentIdempotencyKey: string | null;

  // Actions
  setFormField: (field: keyof WithdrawFormData, value: string | boolean) => void;
  submitWithdrawal: () => Promise<void>;
  resetForm: () => void;
  retrySubmission: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Initial form data — extracted so resetForm can reuse it cleanly
// ---------------------------------------------------------------------------

const initialFormData: WithdrawFormData = {
  amount: '',
  destination: '',
  confirmed: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWithdrawStore = create<WithdrawState>((set, get) => ({
  // --- Initial State ---
  formData: { ...initialFormData },
  status: 'idle',
  withdrawal: null,
  error: null,
  currentIdempotencyKey: null,

  // ---------------------------------------------------------------------------
  // setFormField
  // Updates a single form field by key.
  // WHY keyof WithdrawFormData: ensures only valid field names are accepted —
  // typos are caught at compile time, not runtime.
  // ---------------------------------------------------------------------------
  setFormField: (field, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [field]: value,
      },
    }));
  },

  // ---------------------------------------------------------------------------
  // submitWithdrawal
  // Initiates a NEW withdrawal submission.
  //
  // LAYER 2 DOUBLE-SUBMIT PROTECTION (Store Layer):
  // Guard clause rejects calls when status is already 'loading'.
  // This prevents programmatic double-calls even if the UI button is bypassed.
  //
  // A NEW idempotency key is generated here — never reused from a prior attempt.
  // WHY: A new submission is a new financial intent. It must have its own key.
  // ---------------------------------------------------------------------------
  submitWithdrawal: async () => {
    const { status, formData } = get();

    // Store-layer double-submit guard
    // ONLY proceeds from 'idle' — not from 'loading', 'success', or 'error'
    if (status === 'loading') return;

    // Generate a fresh idempotency key for this new submission
    const idempotencyKey = generateIdempotencyKey();

    set({
      status: 'loading',
      error: null,
      currentIdempotencyKey: idempotencyKey,
    });

    try {
      const withdrawal = await submitWithdrawal({
        amount: parseFloat(formData.amount),
        destination: formData.destination.trim(),
        idempotency_key: idempotencyKey,
      });

      // Fetch the latest withdrawal details via GET /v1/withdrawals/{id}
      // WHY: POST may return 'pending'. GET gives us the authoritative record.
      const confirmed = await getWithdrawal(withdrawal.id);

      set({
        status: 'success',
        withdrawal: confirmed,
        error: null,
        // formData intentionally kept — preserves values if user navigates back
      });
    } catch (err) {
      // On error: status → 'error', form data is NEVER cleared
      // WHY: User must be able to retry without re-entering their details
      set({
        status: 'error',
        error: err as ApiError,
        withdrawal: null,
        // formData is NOT touched — preserved for retry
      });
    }
  },

  // ---------------------------------------------------------------------------
  // retrySubmission
  // Retries a failed submission using the SAME idempotency key.
  //
  // WHY reuse the key: If the original request reached the server before
  // failing, retrying with the same key returns the cached response instead
  // of creating a duplicate withdrawal. This is the core of idempotency.
  // ---------------------------------------------------------------------------
  retrySubmission: async () => {
    const { status, formData, currentIdempotencyKey } = get();

    // Can only retry from an error state
    if (status !== 'error') return;

    // Safety check — should always exist if we reached 'error' via submitWithdrawal
    if (!currentIdempotencyKey) return;

    set({
      status: 'loading',
      error: null,
    });

    try {
      const withdrawal = await submitWithdrawal({
        amount: parseFloat(formData.amount),
        destination: formData.destination.trim(),
        idempotency_key: currentIdempotencyKey, // REUSE — not a new key
      });

      const confirmed = await getWithdrawal(withdrawal.id);

      set({
        status: 'success',
        withdrawal: confirmed,
        error: null,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err as ApiError,
        withdrawal: null,
        // formData preserved again — still not touched
      });
    }
  },

  // ---------------------------------------------------------------------------
  // resetForm
  // Clears all state back to initial values.
  // Called when user clicks "New Withdrawal" from the success screen.
  // ---------------------------------------------------------------------------
  resetForm: () => {
    set({
      formData: { ...initialFormData },
      status: 'idle',
      withdrawal: null,
      error: null,
      currentIdempotencyKey: null,
    });
  },
}));