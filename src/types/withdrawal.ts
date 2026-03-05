// === Request Types ===
export interface WithdrawRequest {
  amount: number;
  destination: string;
  idempotency_key: string;
}

// === Response Types ===
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Withdrawal {
  id: string;
  amount: number;
  destination: string;
  currency: string; // Always 'USDT' per spec
  status: WithdrawalStatus;
  created_at: string;
  updated_at: string;
}

// === UI State Machine ===
export type WithdrawFormState = 'idle' | 'loading' | 'success' | 'error';

// === Error Types ===
export interface ApiError {
  status: number;
  message: string;
  isConflict: boolean;    // 409 specifically
  isRetryable: boolean;   // Network errors, 5xx
}

// === Form State ===
export interface WithdrawFormData {
  amount: string;      // String for input handling, parsed to number on submit
  destination: string;
  confirmed: boolean;
}