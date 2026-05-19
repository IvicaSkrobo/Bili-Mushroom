import { APP_VERSION } from '@/lib/appMeta';
import type { Lang } from '@/i18n/index';
import type { Theme } from '@/stores/appStore';

export const BUG_REPORT_ENDPOINT = import.meta.env.VITE_BUG_REPORT_ENDPOINT?.trim() ?? '';

export interface BugReportPayload {
  title: string;
  description: string;
  steps: string;
  contact: string;
  language: Lang;
  theme: Theme;
  source: 'app' | 'website';
  trap?: string;
}

export function isBugReportConfigured(): boolean {
  return /^https:\/\//i.test(BUG_REPORT_ENDPOINT);
}

export function buildBugReportPayload(
  payload: BugReportPayload,
): BugReportPayload & { appVersion: string; userAgent: string; platform: string; reportedAt: string } {
  return {
    ...payload,
    title: payload.title.trim(),
    description: payload.description.trim(),
    steps: payload.steps.trim(),
    contact: payload.contact.trim(),
    trap: payload.trap?.trim() ?? '',
    appVersion: APP_VERSION,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    reportedAt: new Date().toISOString(),
  };
}

export async function submitBugReport(payload: BugReportPayload): Promise<void> {
  if (!isBugReportConfigured()) {
    throw new Error('BUG_REPORT_ENDPOINT_NOT_CONFIGURED');
  }

  const response = await fetch(BUG_REPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildBugReportPayload(payload)),
  });

  if (!response.ok) {
    let message = `Bug report failed (${response.status})`;
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the HTTP status message if the worker did not return JSON.
    }
    throw new Error(message);
  }
}
