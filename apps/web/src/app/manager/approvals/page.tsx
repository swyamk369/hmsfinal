import { redirect } from 'next/navigation';

export default function ManagerApprovalsRedirect() {
  redirect('/finance/approvals');
}
