'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import Protected from '@/components/Protected';
import { formatDateTime } from '@/lib/format';
import { Button, Card, Input, Select, PageHeader, StatusChip, Badge, ErrorState } from '@/components/ui';
import { useToast } from '@/components/toast';
import { supportApi, type SupportTicket } from '@/lib/support-api';

function TicketDetailInner() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const toast = useToast();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setTicket(await supportApi.getTicket(id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(status: string) {
    try {
      await supportApi.updateStatus(id, status);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await supportApi.addComment(id, reply);
      setReply('');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
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
                <h1 className="text-title-lg font-bold text-ink mb-1">{ticket.title}</h1>
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
                <div
                  key={c.id}
                  className={`flex ${c.authorId === ticket.reporterId ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${c.authorId === ticket.reporterId ? 'bg-canvas text-ink' : 'bg-primary-50 text-primary-900 border border-primary-100'}`}
                  >
                    <div className="text-body-md mb-2">{c.content}</div>
                    <div className="text-label-sm text-ink-soft flex items-center gap-2">
                      <Badge tone="slate">{c.authorType}</Badge>
                      {formatDateTime(c.createdAt)}
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
                <Badge
                  tone={
                    ticket.priority === 'URGENT' || ticket.priority === 'HIGH'
                      ? 'danger'
                      : ticket.priority === 'MEDIUM'
                        ? 'warning'
                        : 'slate'
                  }
                >
                  {ticket.priority}
                </Badge>
              </div>

              <div>
                <div className="text-ink-soft mb-1">Created</div>
                <div>{formatDateTime(ticket.createdAt)}</div>
              </div>

              <div>
                <div className="text-ink-soft mb-1">Tenant ID</div>
                <div className="font-mono">{ticket.tenantId || 'Global'}</div>
              </div>
            </div>
          </Card>
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
