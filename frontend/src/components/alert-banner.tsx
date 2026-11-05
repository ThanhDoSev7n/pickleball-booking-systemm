import type { ReactNode } from 'react';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const TONES: Record<AlertTone, string> = {
  error: 'border-danger-500/40 bg-danger-50 text-danger-600',
  success: 'border-brand-500/40 bg-brand-50 text-brand-700',
  warning: 'border-warn-500/40 bg-warn-50 text-warn-700',
  info: 'border-court-500/40 bg-court-50 text-court-600',
};

export interface AlertBannerProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}

export function AlertBanner({ tone = 'info', title, children, action, onDismiss }: AlertBannerProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}>
      <span className="mt-0.5 text-base leading-none" aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'error' ? '⚠' : tone === 'warning' ? '⏱' : 'ℹ'}
      </span>
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded-md px-2 text-lg leading-none opacity-70 hover:opacity-100">
          ×
        </button>
      ) : null}
    </div>
  );
}
