'use client';

import { useWithdrawStore } from '@/stores/useWithdrawStore';
import WithdrawForm from '@/components/WithdrawForm';
import WithdrawSuccess from '@/components/WithdrawSuccess';

export default function WithdrawPage() {
  const { status } = useWithdrawStore();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Withdraw USDT</h1>
        {status === 'success' ? <WithdrawSuccess /> : <WithdrawForm />}
      </div>
    </main>
  );
}