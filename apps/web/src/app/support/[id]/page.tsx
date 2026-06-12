'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import Protected from '@/components/Protected';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, StatusChip, Textarea } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { supportApi, type SupportTicket } from '@/lib/support-api';

function priorityTone(priority: SupportTicket['priority']) {
  return priority === 'URGENT' || priority === 'HIGH' ? 'danger' : priority === 'MEDIUM' ? 'warning' : 'slate';
}

function TicketDetailInner() {
  const router = useRouter();
  const toast = useToast();
  const { activeTenantId } = useAuth();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    if (!id || !activeTenantId) return;
    setErr(null);
    try {
      setTicket(await supportApi.getTicket(id, activeTenantId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply() {
    if (!id || !activeTenantId || !reply.trim()) return;
    setReplying(true);
    try {
      await supportApi.addComment(id, reply.trim(), activeTenantId);
      setReply('');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReplying(false);
    }
  }

  async function closeTicket() {
    if (!id || !activeTenantId) return;
    setClosing(true);
    try {
      await supportApi.updateStatus(id, 'CLOSED', activeTenantId);
      toast.success('Ticket closed.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClosing(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!ticket) return <Spinner label="Loading ticket..." />;

  return (
    <>
      <PageHeader
        title="Support Ticket"
        subtitle={`Ticket ${ticket.id.slice(0, 8)} - ${formatDateTime(ticket.createdAt)}`}
        action={
          <Button variant="ghost" onClick={() => router.push('/support')}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-title-lg text-ink">{ticket.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusChip status={ticket.status} />
                  <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                </div>
              </div>
              {ticket.status !== 'CLOSED' && (
                <Button variant="ghost" icon={CheckCircle2} loading={closing} onClick={closeTicket}>
                  Close ticket
                </Button>
              )}
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-canvas p-4 text-body-md text-ink">{ticket.description}</p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-title-md text-ink">
              <MessageSquare className="h-5 w-5" />
              Conversation
            </h2>

            <div className="mb-5 space-y-4">
              {ticket.comments.length === 0 ? (
                <div className="rounded-md border border-line bg-canvas px-4 py-6 text-center text-body-sm text-ink-soft">
                  No replies yet.
                </div>
              ) : (
                ticket.comments.map((comment) => {
                  const byReporter = comment.authorId === ticket.reporterId;
                  return (
                    <div key={comment.id} className={`flex ${byReporter ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-md border p-4 ${
                          byReporter
                            ? 'border-line bg-canvas text-ink'
                            : 'border-primary-100 bg-primary-50 text-primary-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-body-md">{comment.content}</p>
                        <div className="mt-2 text-label-sm text-ink-soft">
                          {byReporter ? 'Hospital staff' : 'Platform support'} - {formatDateTime(comment.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply to support..."
                className="min-h-20 flex-1"
              />
              <Button icon={Send} loading={replying} disabled={!reply.trim()} onClick={handleReply}>
                Send
              </Button>
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-4 text-title-md text-ink">Details</h2>
          <div className="space-y-4 text-body-sm">
            <div>
              <div className="text-label-sm uppercase text-ink-soft">Status</div>
              <div className="mt-1">
                <StatusChip status={ticket.status} />
              </div>
            </div>
            <div>
              <div className="text-label-sm uppercase text-ink-soft">Priority</div>
              <div className="mt-1">
                <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
              </div>
            </div>
            <div>
              <div className="text-label-sm uppercase text-ink-soft">Created</div>
              <div className="mt-1 text-ink">{formatDateTime(ticket.createdAt)}</div>
            </div>
            <div>
              <div className="text-label-sm uppercase text-ink-soft">Last updated</div>
              <div className="mt-1 text-ink">{formatDateTime(ticket.updatedAt)}</div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export default function TenantTicketDetailPage() {
  return (
    <Protected>
      <TicketDetailInner />
    </Protected>
  );
}
