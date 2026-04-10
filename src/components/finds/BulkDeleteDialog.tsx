import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBulkDeleteFinds } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';

interface BulkDeleteDialogProps {
  count: number;
  findIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkDeleteDialog({ count, findIds, open, onOpenChange, onSuccess }: BulkDeleteDialogProps) {
  const t = useT();
  const [deleteFiles, setDeleteFiles] = useState(false);
  const bulkDelete = useBulkDeleteFinds();

  function handleConfirm() {
    bulkDelete.mutate(
      { findIds, deleteFiles },
      { onSuccess: () => { onOpenChange(false); onSuccess(); } },
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('collection.deleteSelected', { n: count })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={deleteFiles ? 'files' : 'record'}
          onValueChange={(val) => setDeleteFiles(val === 'files')}
          className="gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="record" id="bulk-delete-record-only" />
            <Label htmlFor="bulk-delete-record-only">{t('delete.recordOnly')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="files" id="bulk-delete-record-files" />
            <Label htmlFor="bulk-delete-record-files">{t('delete.recordAndFiles')}</Label>
          </div>
        </RadioGroup>

        {bulkDelete.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {bulkDelete.error instanceof Error
                ? bulkDelete.error.message
                : t('delete.confirm')}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={bulkDelete.isPending}>
            {bulkDelete.isPending ? t('delete.deleting') : t('delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
