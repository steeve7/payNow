export type PaymentRow = {
  id: string;
  reference: string;
  bill_type: string;
  gateway: string | null;
  amount: number;
  currency: string | null;
  status: string; // pending/success/failed
  payload: any;
  created_at: string;

  vend_status?: string | null;
  vend_provider?: string | null;
  vended_at?: string | null;
  vend_last_error?: string | null;
  vend_response?: any;
};

export type TransactionStats = {
  totalTransactions: number;
  totalSpent: number;
  billTypeBreakdown: Array<{ bill_type: string; count: number; total: number }>;
  mostRecentTransaction: PaymentRow | null;
};
