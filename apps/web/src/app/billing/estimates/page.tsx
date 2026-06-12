'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Plus, Trash2 } from 'lucide-react';

export default function EstimatesPage() {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ name: string; quantity: number; unitPrice: number }[]>([]);
  const queryClient = useQueryClient();

  const { data: estimates, isLoading } = useQuery({
    queryKey: ['estimates', patientId],
    queryFn: () => api.get(`/finance/estimates?patientId=${patientId}`).then(res => res.data),
    enabled: patientId.length > 5,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/finance/estimates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates', patientId] });
      setNotes('');
      setItems([]);
    }
  });

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || items.length === 0) return;
    
    createMutation.mutate({
      patientId,
      notes,
      items: items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: Math.round(i.unitPrice * 100),
        taxRate: 0,
      }))
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cost Estimates</h1>
        <p className="text-muted-foreground">Generate pre-procedure cost estimates for patients.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input id="patientId" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Estimate Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                </div>
                
                {items.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                    No items added. Click "Add Item" to start.
                  </div>
                )}

                {items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                    <div className="grid grid-cols-12 gap-3 flex-grow">
                      <div className="col-span-12 sm:col-span-6">
                        <Label className="text-xs mb-1 block">Item Name</Label>
                        <Input value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} placeholder="e.g. Consultation Fee" />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Label className="text-xs mb-1 block">Quantity</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Label className="text-xs mb-1 block">Price (INR)</Label>
                        <Input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="mt-6 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Disclaimers</Label>
                <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Estimate valid for 30 days. Actual costs may vary." />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || !patientId || items.length === 0}>
                {createMutation.isPending ? 'Generating...' : 'Generate Estimate'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Estimates</CardTitle>
          </CardHeader>
          <CardContent>
            {!patientId ? (
              <div className="text-center py-6 text-muted-foreground">Enter a Patient ID to view their estimates.</div>
            ) : isLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading estimates...</div>
            ) : estimates?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No estimates found for this patient.</div>
            ) : (
              <div className="space-y-4">
                {estimates?.map((est: any) => (
                  <div key={est.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{formatCurrency(est.netAmount)}</div>
                        <div className="text-xs text-muted-foreground">{new Date(est.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        est.status === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
                        est.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {est.status}
                      </span>
                    </div>
                    {est.notes && <div className="text-sm text-muted-foreground mt-2">{est.notes}</div>}
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
