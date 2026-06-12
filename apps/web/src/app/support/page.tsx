'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, LifeBuoy, Route, ShieldCheck, Stethoscope, Plus, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Protected from '@/components/Protected';
import { HelpTip } from '@/components/operations';
import { PageHeader, Section, Button, Modal, FormField, Input, Select, EmptyState, Badge, StatusChip } from '@/components/ui';
import { supportApi, type SupportTicket } from '@/lib/support-api';

const CARDS = [
  {
    href: '/support/workflows',
    title: 'Workflow guides',
    body: 'Step-by-step SOPs for reception, OPD, lab, pharmacy, IPD, billing, insurance, and inventory.',
    icon: Route,
  },
  {
    href: '/support/roles',
    title: 'Role access',
    body: 'What each staff role can usually see and why a permission error may appear.',
    icon: ShieldCheck,
  },
  {
    href: '/support/troubleshooting',
    title: 'Troubleshooting',
    body: 'Fast checks for stuck patients, blocked bills, missing stock, rejected claims, and failed notifications.',
    icon: LifeBuoy,
  },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('LOW');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setTickets(await supportApi.listTickets());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await supportApi.createTicket({ subject, description, category, priority });
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Protected>
      <PageHeader 
        title="Support" 
        subtitle="Operational help for hospital staff" 
        action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Raise Ticket</Button>}
      />
      <div className="space-y-6">
        <HelpTip title="Use this during live work">
          These notes explain the intended workflow and common blockers. They do not bypass permissions; hospital admins
          manage access from Admin Roles.
        </HelpTip>

        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="card p-5 hover:border-primary/50">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 text-title-lg text-ink">{card.title}</h2>
                <p className="mt-1 text-body-sm text-ink-muted">{card.body}</p>
              </Link>
            );
          })}
        </div>

        <Section title="My Support Tickets">
          <div className="p-4 bg-surface rounded-md border border-line">
            {loading ? (
              <div className="text-center text-ink-soft py-4">Loading...</div>
            ) : tickets.length === 0 ? (
              <EmptyState
                title="No support tickets"
                hint="You haven't raised any support tickets yet."
                action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Raise Ticket</Button>}
              />
            ) : (
              <div className="divide-y divide-line">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-ink mb-1">{t.subject}</h4>
                      <div className="flex gap-3 text-label-sm text-ink-soft">
                        <span>{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</span>
                        <span>•</span>
                        <span>ID: {t.id.slice(0,8)}</span>
                        <span>•</span>
                        <Badge variant={t.priority === 'URGENT' ? 'danger' : 'neutral'}>{t.priority}</Badge>
                      </div>
                    </div>
                    <StatusChip status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Need admin help?">
          <div className="flex items-start gap-3 p-5">
            <Stethoscope className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-body-sm text-ink-muted">
              Ask a Hospital Admin to review your role, department, provider profile, and enabled modules if the screen
              says you are missing access for a task that belongs to your job.
            </p>
          </div>
        </Section>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise Support Ticket"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} loading={busy} disabled={!subject.trim() || !description.trim()}>Submit Ticket</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-ink-soft mb-4">Please describe the issue you are facing. Our global support team will look into it.</p>
          <FormField label="Subject" required>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of the issue" />
          </FormField>
          
          <FormField label="Category" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="GENERAL">General</option>
              <option value="BUG">Bug / Technical Issue</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="BILLING">Billing</option>
              <option value="ACCESS">Access & Permissions</option>
            </Select>
          </FormField>

          <FormField label="Priority" required>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent (System Down)</option>
            </Select>
          </FormField>

          <FormField label="Description" required>
            <textarea
              className="w-full rounded-md border border-line bg-surface p-3 text-body-sm focus:border-primary focus:outline-none"
              rows={4}
              placeholder="Provide as much detail as possible..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>
    </Protected>
  );
}

function SupportNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2">
      <div className="flex items-center gap-2 text-body-sm font-medium text-ink">
        <BookOpen className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-1 text-body-sm text-ink-muted">{text}</p>
    </div>
  );
}
