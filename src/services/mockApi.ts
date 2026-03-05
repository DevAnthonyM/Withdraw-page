import { WithdrawRequest, Withdrawal } from '@/types/withdrawal';


/**
 * In-memory store of submitted idempotency keys.
 * WHY: Simulates server-side deduplication — if the same key is sent twice,
 * the server would return 409 Conflict. This Set mimics that behavior.
 */
const submittedKeys = new Set<string>();

/**
 * In-memory store of created withdrawals (keyed by ID).
 * WHY: Allows getWithdrawalMock to return the same withdrawal
 * that was created by submitWithdrawalMock, just like a real API would.
 */
const withdrawalStore = new Map<string, Withdrawal>();

/**
 * Configurable failure rate for testing error paths.
 * WHY: In real payment systems, transient failures happen.
 * Setting this > 0 lets us test the retry and error UI flows.
 * Set to 0 in normal usage, override in tests as needed.
 */
export const mockConfig = {
  failureRate: 0,        // 0 = never fail, 1 = always fail (0–1 range)
  forceStatus: null as number | null, // Override response status for testing
};

/**
 * Simulates network latency (200–500ms).
 * WHY: Real APIs have latency. Testing with instant responses
 * hides race conditions and loading-state bugs.
 */
function simulateLatency(): Promise<void> {
  const delay = Math.floor(Math.random() * 300) + 200; // 200–500ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Builds a mock Response object with a JSON body.
 * WHY: withdrawalApi.ts expects a real Response — we return one here
 * so the real service layer can call response.json(), response.status, etc.
 * No special-casing needed in the service layer.
 */
function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mock implementation of POST /v1/withdrawals.
 *
 * Behaviors:
 * - 200–500ms simulated latency
 * - 409 if same idempotency_key submitted twice
 * - Configurable failure rate for 5xx simulation
 * - Returns a proper Withdrawal object on success
 */
export async function submitWithdrawalMock(request: WithdrawRequest): Promise<Response> {
  await simulateLatency();

  // Allow test overrides via forceStatus
  if (mockConfig.forceStatus !== null) {
    if (mockConfig.forceStatus === 409) {
      return mockResponse(409, { message: 'Conflict' });
    }
    if (mockConfig.forceStatus >= 500) {
      return mockResponse(mockConfig.forceStatus, { message: 'Internal Server Error' });
    }
  }

  // Simulate configurable failure rate (5xx)
  if (mockConfig.failureRate > 0 && Math.random() < mockConfig.failureRate) {
    return mockResponse(500, { message: 'Internal Server Error' });
  }

  // Simulate 409 if same idempotency_key sent twice
  if (submittedKeys.has(request.idempotency_key)) {
    return mockResponse(409, { message: 'Conflict: duplicate idempotency_key' });
  }

  // Register this key
  submittedKeys.add(request.idempotency_key);

  // Build and store the withdrawal
  const withdrawal: Withdrawal = {
    id: crypto.randomUUID(),
    amount: request.amount,
    destination: request.destination,
    currency: 'USDT',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  withdrawalStore.set(withdrawal.id, withdrawal);

  return mockResponse(201, withdrawal);
}

/**
 * Mock implementation of GET /v1/withdrawals/{id}.
 *
 * WHY: After a successful POST the status is 'pending'.
 * This endpoint simulates fetching the latest status of a withdrawal.
 * In a real system, you'd poll this until status is 'completed' or 'failed'.
 */
export async function getWithdrawalMock(id: string): Promise<Response> {
  await simulateLatency();

  const withdrawal = withdrawalStore.get(id);

  if (!withdrawal) {
    return mockResponse(404, { message: 'Withdrawal not found' });
  }

  return mockResponse(200, withdrawal);
}

/**
 * Resets mock state — used in tests to ensure a clean slate between test cases.
 * WHY: Tests must be isolated. Shared state between tests causes flaky results.
 */
export function resetMockState(): void {
  submittedKeys.clear();
  withdrawalStore.clear();
  mockConfig.failureRate = 0;
  mockConfig.forceStatus = null;
}