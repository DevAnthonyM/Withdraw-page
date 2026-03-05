# Withdraw Page — BEM Test Assignment

## Quick Start

```bash
git clone https://github.com/DevAnthonyM/Withdraw-page.git
cd Withdraw-page
npm install
npm run dev          # Development server at http://localhost:3000
npm test             # Run test suite
npm run test:watch   # Watch mode
```

---

## Architecture Decisions

### State Machine Pattern

The withdrawal flow uses an explicit state machine (`idle → loading → success | error`)
managed via Zustand. This pattern prevents invalid state combinations
(e.g., showing success and error simultaneously) and makes the UI
behavior predictable and testable.

This mirrors production payment gateway patterns where a transaction must
always be in exactly one well-defined state. Ambiguous states in financial UIs
lead to double charges, user confusion, and support escalations.

### Three-Layer Double-Submit Protection

1. **UI Layer** — Submit button disabled when form is invalid or request is in-flight
2. **Store Layer** — Guard clause rejects submissions unless state is `idle` or `error`
3. **API Layer** — `idempotency_key` (UUID v4) ensures server-side deduplication

The three-layer submit protection ensures financial transaction safety at every
level of the stack. Even if layers 1 and 2 are somehow bypassed (e.g., via
automated scripts or browser devtools), the idempotency key at the API layer
guarantees the server will never process the same withdrawal twice.

This is the same defense-in-depth approach used in production payment systems
processing high transaction volumes — relying on a single layer is never sufficient
when real money is involved.

### Idempotency Key Strategy

- A **NEW** key is generated for each new withdrawal attempt
- The **SAME** key is reused when retrying a failed request
- This ensures retries are safe (server returns cached response)
  while genuinely new submissions get their own unique key

Idempotency keys follow the same strategy used in Stripe's API and other
production payment gateways: the key is tied to the user's *intent*, not
the HTTP request itself. A retry is the same intent — a new submission is
a new intent. Getting this distinction wrong causes either duplicate charges
(new key on retry) or blocked legitimate submissions (same key on new attempt).

### Error Handling Philosophy

- **409 Conflict** → User-friendly message (not raw HTTP error)
- **Network errors** → Automatic retry with exponential backoff (1s, 2s, 4s)
- **4xx errors** → Display message, no retry (client-side issue that won't resolve on retry)
- **5xx errors** → Retry with backoff (server-side transient issue)
- **Form data is NEVER lost** during error states — user can retry without re-entering details

Exponential backoff (1s, 2s, 4s) prevents thundering herd scenarios where
thousands of clients simultaneously hammer a recovering server. This mirrors
the retry strategy used in production payment infrastructure.

### Security Considerations

**Token Storage (Production Approach):**

In this mock implementation, auth is simulated. In production:
- Access tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies
- Refresh tokens handled server-side via Next.js API routes
- **NEVER** in `localStorage` (XSS vulnerable) or `sessionStorage`
- CSRF protection via double-submit cookie pattern or SameSite attribute

In production, token management would use `httpOnly` cookies because
JavaScript cannot read them — eliminating the entire class of XSS-based
token theft attacks that plague localStorage-based auth implementations.

**Additional security measures:**
- No use of `dangerouslySetInnerHTML` anywhere in the codebase
- Input sanitization on all form fields
- Amount parsed and validated server-side (never trust client-only validation)

### API Mock

The API is mocked in `src/services/mockApi.ts`. To switch to a real API:
1. Set `NEXT_PUBLIC_API_URL` in `.env`
2. The service layer automatically uses the real endpoint
3. No component changes needed — the API layer is fully abstracted

The mock simulates realistic behavior:
- 200–500ms network latency
- 409 Conflict when the same `idempotency_key` is submitted twice
- Configurable failure rate for testing error and retry paths

---

## Testing Strategy

Three core tests covering the critical paths:

1. **Happy path** — form submission → API call with `idempotency_key` → success receipt display
2. **Error handling** — 409 conflict → user-friendly message, form data preserved
3. **Resilience** — double-submit prevention: button disabled + API called exactly once

All tests use React Testing Library with `userEvent` for realistic user interactions,
and mock the API service at the module level for full isolation.

---

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict mode — no `any` types)
- **Zustand** (lightweight state management — state machine pattern)
- **Tailwind CSS** (utility-first styling)
- **Jest + React Testing Library** (unit and integration testing)

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home → redirects to /withdraw
│   └── withdraw/
│       └── page.tsx            # Withdraw page (main deliverable)
├── components/
│   ├── WithdrawForm.tsx        # Form — presentation + interaction logic
│   ├── WithdrawSuccess.tsx     # Success receipt display
│   └── WithdrawError.tsx       # Error state display
├── stores/
│   └── useWithdrawStore.ts     # Zustand store — state machine
├── services/
│   ├── withdrawalApi.ts        # API layer — all HTTP calls isolated here
│   └── mockApi.ts              # Mock API — realistic simulation
├── lib/
│   ├── idempotency.ts          # Idempotency key generation
│   └── validators.ts           # Form validation (pure functions)
├── types/
│   └── withdrawal.ts           # TypeScript interfaces and types
└── __tests__/
    └── WithdrawForm.test.tsx   # All 3 required tests
```