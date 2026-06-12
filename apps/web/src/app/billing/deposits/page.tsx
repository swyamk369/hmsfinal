import { redirect } from 'next/navigation';

export default function BillingDepositsRedirect() {
  redirect('/finance/deposits');
}
