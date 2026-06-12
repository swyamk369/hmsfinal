'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, UserSquare2, MessageSquare, Send } from 'lucide-react';
import Protected from '@/components/Protected';
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  StatusChip,
  Badge,
  ErrorState,
} from '@/components/ui';
import { supportApi, type SupportTicket } from '@/lib/support-api';
import { useAuth } from '@/lib/auth-context';

function TicketDetailInner() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { setActiveTenant } = useAuth();
  
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    try {
      setTicket(await supportApi.getTicket(id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleStatusChange(status: string) {
    try {
      await supportApi.updateStatus(id, status);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await supportApi.addComment(id, reply, false);
      setReply('');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleImpersonate() {
    if (!ticket?.tenantId) return;
    setActiveTenant(ticket.tenantId);
    router.push('/dashboard'); // Go to the hospital dashboard as impersonator
  }

  if (err) return <ErrorState message={err} />;
  if (!ticket) return <div className="p-8 text-center text-ink-soft">Loading...</div>;

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" onClick={() => router.back()} className="text-ink-soft hover:text-ink -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tickets
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-title-lg font-bold text-ink mb-1">{ticket.subject}</h1>
                <p className="text-body-sm text-ink-soft font-mono">ID: {ticket.id}</p>
              </div>
              <StatusChip status={ticket.status} />
            </div>
            
            <div className="bg-canvas rounded-lg p-4 mb-6">
              <p className="text-body-md text-ink whitespace-pre-wrap">{ticket.description}</p>
            </div>

            <h3 className="text-title-md font-semibold text-ink mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Activity
            </h3>
            
            <div className="space-y-4 mb-6">
              {ticket.comments.map((c) => (
                <div key={c.id} className={`flex ${c.userId === ticket.userId ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 ${c.userId === ticket.userId ? 'bg-canvas text-ink' : 'bg-primary-50 text-primary-900 border border-primary-100'}`}>
                    <div className="text-body-md mb-2">{c.content}</div>
                    <div className="text-label-sm text-ink-soft flex items-center gap-2">
                      {c.isInternal && <Badge variant="neutral">Internal</Badge>}
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
              {ticket.comments.length === 0 && (
                <div className="text-center text-body-sm text-ink-soft py-4">No comments yet.</div>
              )}
            </div>

            <div className="flex gap-2">
              <Input 
                value={reply} 
                onChange={(e) => setReply(e.target.value)} 
                placeholder="Type your reply..." 
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReply();
                }}
              />
              <Button onClick={handleReply} loading={busy} disabled={!reply.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        <div className="w-full md:w-80 space-y-4">
          <Card className="p-4">
            <h3 className="text-title-md font-semibold text-ink mb-4">Details</h3>
            
            <div className="space-y-3 text-body-sm">
              <div>
                <div className="text-ink-soft mb-1">Status</div>
                <Select value={ticket.status} onChange={(e) => handleStatusChange(e.target.value)}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </Select>
              </div>
              
              <div>
                <div className="text-ink-soft mb-1">Priority</div>
                <Badge variant={ticket.priority === 'URGENT' || ticket.priority === 'HIGH' ? 'danger' : 'neutral'}>
                  {ticket.priority}
                </Badge>
              </div>

              <div>
                <div className="text-ink-soft mb-1">Category</div>
                <Badge variant="neutral">{ticket.category}</Badge>
              </div>

              <div>
                <div className="text-ink-soft mb-1">Created</div>
                <div>{new Date(ticket.createdAt).toLocaleString()}</div>
              </div>
              
              <div>
                <div className="text-ink-soft mb-1">Tenant ID</div>
                <div className="font-mono">{ticket.tenantId || 'Global'}</div>
              </div>
            </div>
          </Card>

          {ticket.tenantId && (
            <Card className="p-4 bg-primary-50 border-primary-100">
              <h3 className="text-title-md font-semibold text-primary-900 mb-2">Tenant Actions</h3>
              <p className="text-body-sm text-primary-800 mb-4">
                You can impersonate this hospital to troubleshoot issues directly.
              </p>
              <Button onClick={handleImpersonate} className="w-full" icon={UserSquare2}>
                Impersonate Admin
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function TicketDetailPage() {
  return (
    <Protected requirePlatform>
      <TicketDetailInner />
    </Protected>
  );
}
