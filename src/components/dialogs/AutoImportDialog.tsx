import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { scanAndImport, type AutoImportProgress, type AutoImportResult } from '@/lib/autoImport';
import { useT } from '@/i18n/index';

interface AutoImportDialogProps {
  storagePath: string;
  onDone: () => void;
}

export function AutoImportDialog({ storagePath, onDone }: AutoImportDialogProps) {
  const t = useT();
  const [progress, setProgress] = useState<AutoImportProgress | null>(null);
  const [result, setResult] = useState<AutoImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scanAndImport(storagePath, setProgress)
      .then(setResult)
      .catch((err) => setError(String(err?.message ?? err)));
  }, [storagePath]);

  const isDone = result !== null || error !== null;
  const pct = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open>
      <DialogContent
        className="w-[420px] max-w-[420px]"
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (!isDone) e.preventDefault(); }}
        onInteractOutside={(e) => { if (!isDone) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <Sprout className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center">
            {isDone ? t('autoImport.title.done') : t('autoImport.title.scanning')}
          </DialogTitle>
          {!isDone && progress && (
            <DialogDescription className="text-center text-xs">
              {t('autoImport.species', { name: progress.species })}
            </DialogDescription>
          )}
        </DialogHeader>

        {!isDone && (
          <div className="space-y-2 py-1">
            <Progress value={pct} />
            <p className="text-center text-xs text-muted-foreground">
              {progress
                ? t('autoImport.progress', { current: progress.current, total: progress.total })
                : '…'}
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-1 py-1 text-sm text-center text-muted-foreground">
            {result.speciesCount === 0 ? (
              <p>{t('autoImport.result.empty')}</p>
            ) : (
              <>
                <p className="text-foreground font-medium">
                  {t('autoImport.result.species', { n: result.speciesCount })}
                </p>
                <p>{t('autoImport.result.imported', { n: result.imported })}</p>
                {result.skipped > 0 && (
                  <p>{t('autoImport.result.skipped', { n: result.skipped })}</p>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-1">{error}</p>
        )}

        <div className="flex gap-2 justify-center pt-1">
          {isDone ? (
            <Button onClick={onDone}>{t('autoImport.done')}</Button>
          ) : (
            <Button variant="ghost" onClick={onDone}>{t('autoImport.skip')}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
