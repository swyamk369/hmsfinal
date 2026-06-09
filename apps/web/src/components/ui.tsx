'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Inbox, X, type LucideIcon } from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: LucideIcon;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base = { primary: 'btn-primary', dark: 'btn-dark', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];
  return (
    <button className={cx(base, size === 'sm' && 'btn-sm', className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Form controls
// ─────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx('input', className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('input', className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('input pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {required && <span className="required-dot" aria-hidden />}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-body-sm text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-body-sm text-danger">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('card', className)}>{children}</div>;
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          {title && <h3 className="text-title-lg text-ink">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-display-lg text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-body-md text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  icon?: LucideIcon;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="text-label-md uppercase text-ink-muted">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-ink-soft" />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-headline-md text-ink">{value}</div>
        {trend && (
          <span className={cx('mb-1 text-body-sm font-medium', trend.positive ? 'text-success' : 'text-danger')}>
            {trend.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-body-sm text-ink-soft">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chips / badges
// ─────────────────────────────────────────────────────────────
type Tone = 'slate' | 'success' | 'warning' | 'danger' | 'primary' | 'blue' | 'green' | 'amber' | 'red';
const toneClass: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  primary: 'bg-primary-50 text-primary-700',
  // back-compat aliases
  blue: 'bg-primary-50 text-primary-700',
  green: 'bg-success-bg text-success-fg',
  amber: 'bg-warning-bg text-warning-fg',
  red: 'bg-danger-bg text-danger-fg',
};

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx('chip', toneClass[tone])}>{children}</span>;
}

const SUCCESS = ['ACTIVE', 'PAID', 'COMPLETED', 'VERIFIED', 'DISPENSED', 'APPROVED', 'SETTLED', 'AVAILABLE', 'NORMAL'];
const WARN = [
  'PENDING',
  'PROCESSING',
  'TRIAL',
  'TRIALING',
  'PARTIAL',
  'DRAFT',
  'SAMPLE_COLLECTED',
  'ORDERED',
  'PENDING_SETUP',
  'SCHEDULED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'RESERVED',
  'PAST_DUE',
];
const DANGER = [
  'SUSPENDED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
  'CRITICAL',
  'HIGH',
  'LOW',
  'OCCUPIED',
  'NO_SHOW',
  'REFUNDED',
];

export function StatusChip({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const tone: Tone = SUCCESS.includes(s)
    ? 'success'
    : WARN.includes(s)
      ? 'warning'
      : DANGER.includes(s)
        ? 'danger'
        : 'slate';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}

// ─────────────────────────────────────────────────────────────
// States: loading / empty / error
// ─────────────────────────────────────────────────────────────
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-body-sm text-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cx('h-4', c === 0 ? 'w-40' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink-soft">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-title-lg text-ink">{title}</div>
      {hint && <div className="mt-1 max-w-md text-body-sm text-ink-soft">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
/** Back-compat alias. */
export const ErrorNote = ({ message }: { message: string }) => <ErrorState message={message} />;

// ─────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-line bg-surface shadow-raised"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className={cx('text-title-lg', danger ? 'text-danger' : 'text-ink')}>{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-soft hover:bg-canvas" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Mandatory-reason modal for destructive actions (per the design system + plan).
 * Confirm is disabled until a non-empty reason is provided.
 */
export function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function confirm() {
    if (!reason.trim()) {
      setErr('A reason is required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      danger
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="mb-3 text-body-md text-ink-muted">{description}</p>}
      <FormField label="Reason for action" required error={err}>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Document why this action is being taken (kept in the audit trail)…"
          autoFocus
        />
      </FormField>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Phase placeholder (honest "built later" state)
// ─────────────────────────────────────────────────────────────
export function PhasePlaceholder({
  module,
  phase,
  children,
}: {
  module: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-8">
      <Badge tone="primary">{module}</Badge>
      <h2 className="mt-3 text-title-lg text-ink">Workflow coming in {phase}</h2>
      <p className="mt-1 max-w-xl text-body-md text-ink-muted">
        The data model, RLS isolation, permissions, and module entitlement for this area are already in place. The
        operational screens land in {phase} of the build plan.
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
