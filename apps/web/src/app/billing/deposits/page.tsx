'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

export default function AdvanceDepositsPage() {
  const [patientId, setPatientId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: deposits, isLoading } = useQuery({
    queryKey: ['deposits', patientId],
    queryFn: () => api.get(`/finance/advance-deposits?patientId=${patientId}`).then(res => res.data),
    enabled: patientId.length > 5,
  });

  const collectMutation = useMutation({
    mutationFn: (data: any) => api.post('/finance/advance-deposits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits', patientId] });
      setAmount('');
      setNotes('');
    }
  });

  const handleCollect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !amount) return;
    collectMutation.mutate({
      patientId,
      amount: Math.round(parseFloat(amount) * 100), // convert to paise
      paymentMethod,
      notes,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advance Deposits</h1>
        <p className="text-muted-foreground">Collect and manage patient advance deposits.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Collect Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCollect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input id="patientId" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (INR)</Label>
                <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks" />
              </div>
              <Button type="submit" disabled={collectMutation.isPending || !patientId || !amount}>
                {collectMutation.isPending ? 'Collecting...' : 'Collect Deposit'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Deposit Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {!patientId ? (
              <div className="text-center py-6 text-muted-foreground">Enter a Patient ID to view their ledger.</div>
            ) : isLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading deposits...</div>
            ) : deposits?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No deposits found for this patient.</div>
            ) : (
              <div className="space-y-4">
                {deposits?.map((d: any) => (
                  <div key={d.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{formatCurrency(d.amount)}</div>
                      <div className="text-sm text-muted-foreground">{d.paymentMethod} • {new Date(d.createdAt).toLocaleDateString()}</div>
                      {d.notes && <div className="text-xs text-muted-foreground mt-1">{d.notes}</div>}
                    </div>
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        d.status === 'COLLECTED' ? 'bg-green-100 text-green-800' :
                        d.status === 'CONSUMED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
