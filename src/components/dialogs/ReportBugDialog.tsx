import { useMemo, useState } from 'react';
import { Bug, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_VERSION } from '@/lib/appMeta';
import { isBugReportConfigured, submitBugReport } from '@/lib/bugReport';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';

interface ReportBugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialForm = {
  title: '',
  description: '',
  steps: '',
  contact: '',
  trap: '',
};

export function ReportBugDialog({ open, onOpenChange }: ReportBugDialogProps) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const theme = useAppStore((s) => s.theme);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => form.title.trim().length >= 4 && form.description.trim().length >= 10,
    [form.description, form.title],
  );

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await submitBugReport({
        ...form,
        language,
        theme,
        source: 'app',
      });
      toast.success(t('bugReport.success'));
      setForm(initialForm);
      onOpenChange(false);
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      if (message === 'BUG_REPORT_ENDPOINT_NOT_CONFIGURED') {
        toast.error(t('bugReport.notConfigured'));
      } else {
        toast.error(t('bugReport.error'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            {t('bugReport.title')}
          </DialogTitle>
          <DialogDescription>
            {t('bugReport.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!isBugReportConfigured() && (
            <div className="rounded-sm border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
              {t('bugReport.notConfigured')}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="bug-title">{t('bugReport.problemTitle')}</Label>
            <Input
              id="bug-title"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder={t('bugReport.problemTitlePlaceholder')}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bug-description">{t('bugReport.whatHappened')}</Label>
            <Textarea
              id="bug-description"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder={t('bugReport.whatHappenedPlaceholder')}
              className="min-h-28"
              maxLength={3000}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bug-steps">{t('bugReport.steps')}</Label>
            <Textarea
              id="bug-steps"
              value={form.steps}
              onChange={(event) => updateField('steps', event.target.value)}
              placeholder={t('bugReport.stepsPlaceholder')}
              className="min-h-24"
              maxLength={2000}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bug-contact">{t('bugReport.contact')}</Label>
            <Input
              id="bug-contact"
              value={form.contact}
              onChange={(event) => updateField('contact', event.target.value)}
              placeholder={t('bugReport.contactPlaceholder')}
              maxLength={160}
            />
          </div>

          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={form.trap}
            onChange={(event) => updateField('trap', event.target.value)}
            aria-hidden="true"
          />

          <div className="rounded-sm border border-border bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
            {t('bugReport.technicalInfo', {
              version: APP_VERSION,
              language,
              theme,
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('bugReport.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting || !isBugReportConfigured()}>
            <Send className="h-4 w-4" />
            {submitting ? t('bugReport.sending') : t('bugReport.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
