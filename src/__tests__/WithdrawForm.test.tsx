import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WithdrawPage from '@/app/withdraw/page';
import * as withdrawalApi from '@/services/withdrawalApi';
import { Withdrawal } from '@/types/withdrawal';
import { useWithdrawStore } from '@/stores/useWithdrawStore';

// ---------------------------------------------------------------------------
// Mock the entire API service module.
// WHY: Tests must never make real network calls. We control the API responses
// here so we can deterministically test every code path.
// ---------------------------------------------------------------------------
jest.mock('@/services/withdrawalApi');

// ---------------------------------------------------------------------------
// Typed mock references — lets us call .mockResolvedValue etc. with full types
// ---------------------------------------------------------------------------
const mockSubmitWithdrawal = withdrawalApi.submitWithdrawal as jest.MockedFunction<
  typeof withdrawalApi.submitWithdrawal
>;
const mockGetWithdrawal = withdrawalApi.getWithdrawal as jest.MockedFunction<
  typeof withdrawalApi.getWithdrawal
>;

// ---------------------------------------------------------------------------
// A valid withdrawal object returned by the mock API on success
// ---------------------------------------------------------------------------
const mockWithdrawal: Withdrawal = {
  id: 'test-withdrawal-id-123',
  amount: 100,
  destination: '0x1234567890abcdef',
  currency: 'USDT',
  status: 'pending',
  created_at: '2024-01-01T10:00:00.000Z',
  updated_at: '2024-01-01T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helper: fill the form with valid data
// Reused across all three tests to keep them DRY.
// ---------------------------------------------------------------------------
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/amount/i), '100');
  await user.type(screen.getByLabelText(/destination/i), '0x1234...abcd');
  await user.click(screen.getByLabelText(/confirm/i));
}

describe('WithdrawForm', () => {
  beforeEach(() => {
    // Reset all mocks and Zustand store state before each test
    jest.clearAllMocks();

    // Reset Zustand store to initial state between tests
    // WHY: Zustand store persists across renders in the same test run.
    // Without reset, state from test 1 leaks into test 2.
    useWithdrawStore.getState().resetForm();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Happy-path submit
  //
  // GIVEN a valid form (amount > 0, destination filled, confirmed checked)
  // WHEN user clicks submit
  // THEN API is called with correct payload including idempotency_key
  // AND success state is displayed with withdrawal details
  // -------------------------------------------------------------------------
  test('happy-path: submits withdrawal and shows success', async () => {
    const user = userEvent.setup();

    // Mock both API calls to succeed
    mockSubmitWithdrawal.mockResolvedValue(mockWithdrawal);
    mockGetWithdrawal.mockResolvedValue(mockWithdrawal);

    render(<WithdrawPage />);

    // Fill form with valid data
    await fillValidForm(user);

    // Submit the form
    await user.click(screen.getByRole('button', { name: /submit withdrawal/i }));

    // Assert API was called with correct payload including idempotency_key
    await waitFor(() => {
      expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1);
      expect(mockSubmitWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          destination: '0x1234...abcd',
          idempotency_key: expect.any(String),
        })
      );
    });

    // Assert GET was called to fetch withdrawal details
    await waitFor(() => {
      expect(mockGetWithdrawal).toHaveBeenCalledWith(mockWithdrawal.id);
    });

    // Assert success state is displayed with withdrawal details
    await waitFor(() => {
      expect(screen.getByText('Withdrawal Submitted')).toBeInTheDocument();
      expect(screen.getByText(mockWithdrawal.id)).toBeInTheDocument();
      expect(screen.getByText('100.00 USDT')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // TEST 2: API error handling — 409 Conflict
  //
  // GIVEN a valid form
  // WHEN API returns 409 Conflict
  // THEN user-friendly conflict message is shown (NOT raw HTTP error)
  // AND form data is preserved
  // AND user can see their entered values
  // -------------------------------------------------------------------------
  test('shows user-friendly message on 409 conflict', async () => {
    const user = userEvent.setup();

    // Mock API to reject with a 409 conflict error
    mockSubmitWithdrawal.mockRejectedValue({
      status: 409,
      message: 'Conflict',
      isConflict: true,
      isRetryable: false,
    });

    render(<WithdrawPage />);

    // Fill form with valid data
    await fillValidForm(user);

    // Submit the form
    await user.click(screen.getByRole('button', { name: /submit withdrawal/i }));

    // Assert user-friendly conflict message is shown — NOT raw "HTTP 409"
    await waitFor(() => {
      expect(
        screen.getByText(
          /this withdrawal has already been submitted/i
        )
      ).toBeInTheDocument();
    });

    // Assert form data is preserved — user can see their entered values
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0x1234...abcd')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // TEST 3: Double-submit protection
  //
  // GIVEN a form in 'loading' state (submission in progress)
  // WHEN user attempts to click submit again
  // THEN the submit button is disabled
  // AND no second API call is made
  // -------------------------------------------------------------------------
  test('prevents double submission while loading', async () => {
    const user = userEvent.setup();

    // Mock API to never resolve — keeps the store in 'loading' state
    // WHY: We need to test the UI while the request is in-flight.
    mockSubmitWithdrawal.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    mockGetWithdrawal.mockResolvedValue(mockWithdrawal);

    render(<WithdrawPage />);

    // Fill form with valid data
    await fillValidForm(user);

    // Click submit once — puts store into 'loading'
    await user.click(screen.getByRole('button', { name: /submit withdrawal/i }));

    // Assert button is now disabled (loading state)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    });

    // Attempt to click the disabled button again
    await user.click(screen.getByRole('button', { name: /processing/i }));

    // Assert API was only called ONCE — second click had no effect
    expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1);
  });
});