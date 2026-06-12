"use client";

import { useState } from 'react';
import { Button, Card, Badge, Modal, Input } from '@/components/ui';
import { Plus } from 'lucide-react';

export function DepositsList() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-900">Patient Deposits</h2>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Collect Deposit
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No advance deposits found.
                  </td>
                </tr>
              ) : (
                deposits.map((d: any) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{d.patientId}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${d.amount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{d.paymentMethod}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <Badge tone={d.status === 'COLLECTED' ? "success" : "slate"}>
                        {d.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Collect Advance Deposit">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Patient ID</label>
            <Input placeholder="Search patient..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Amount</label>
            <Input type="number" placeholder="0.00" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button variant="primary">Collect Deposit</Button>
        </div>
      </Modal>
    </div>
  );
}
