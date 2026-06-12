"use client";

import { useState } from 'react';
import { Button, Card, Badge, Modal, Input } from '@/components/ui';
import { Plus, Edit, Trash2 } from 'lucide-react';

export function TariffList() {
  const [lists, setLists] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-900">Price Lists</h2>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Price List
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {lists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No price lists defined. Click "New Price List" to create one.
                  </td>
                </tr>
              ) : (
                lists.map((list: any) => (
                  <tr key={list.id}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-sm text-slate-900">{list.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{list.description}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <Badge tone={list.active ? "success" : "slate"}>
                        {list.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-brand-600 hover:text-brand-900 mx-2"><Edit className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Create Price List">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input placeholder="e.g. Standard OPD Rates 2026" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Input placeholder="e.g. Base rates for self-paying patients" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button variant="primary">Save Price List</Button>
        </div>
      </Modal>
    </div>
  );
}
