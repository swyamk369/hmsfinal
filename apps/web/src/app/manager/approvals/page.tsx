'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/finance/governance/requests/pending').then(res => res.data),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      api.put(`/finance/governance/requests/${id}/resolve`, { status, decisionReason: 'Resolved by Manager' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance Approvals</h1>
        <p className="text-muted-foreground">Manage pending requests for discounts, refunds, and bill cancellations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading approvals...</div>
          ) : approvals?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No pending approvals at this time.</div>
          ) : (
            <div className="space-y-4">
              {approvals?.map((req: any) => (
                <div key={req.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg">
                  <div className="mb-4 sm:mb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{req.type}</span>
                      <span className="text-muted-foreground text-sm">for {req.entity}</span>
                    </div>
                    {req.amount && (
                      <div className="text-lg font-bold text-primary mt-1">
                        Amount: {formatCurrency(req.amount)}
                      </div>
                    )}
                    <div className="text-sm mt-2 text-muted-foreground">Reason: {req.reason}</div>
                    {req.notes && <div className="text-sm text-muted-foreground">Notes: {req.notes}</div>}
                    <div className="text-xs text-muted-foreground mt-2">
                      Requested: {new Date(req.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto text-destructive hover:bg-destructive hover:text-white"
                      disabled={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ id: req.id, status: 'REJECTED' })}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button 
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                      disabled={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ id: req.id, status: 'APPROVED' })}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
