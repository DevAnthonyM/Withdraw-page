import { WithdrawFormData } from '@/types/withdrawal';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// WHY pure functions: Testable without React rendering.
// These functions have no side effects — they take data in and return a result.
// This pattern means the validation logic can be unit tested directly,
// without mounting any component.
export function validateWithdrawForm(data: WithdrawFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Amount validation
  const amount = parseFloat(data.amount);
  if (!data.amount || data.amount.trim() === '') {
    errors.amount = 'Amount is required';
  } else if (isNaN(amount)) {
    errors.amount = 'Amount must be a valid number';
  } else if (amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  // Destination validation
  if (!data.destination || data.destination.trim() === '') {
    errors.destination = 'Destination address is required';
  }

  // Confirmation validation
  if (!data.confirmed) {
    errors.confirmed = 'You must confirm the withdrawal';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}