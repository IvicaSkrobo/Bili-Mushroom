import { useState, useEffect } from 'react';
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
import { useDeleteFind } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';
import type { Find } from '@/lib/finds';

interface DeleteFindDialogProps {
  find: Find | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteFindDialog({ find, onOpenChange }: DeleteFindDialogProps) {
  const t = useT();
  const [deleteFiles, setDeleteFiles] = useState(false);
  const deleteMutation = useDeleteFind();

  useEffect(() => {
    setDeleteFiles(false);
  }, [find]);

  async function handleConfirm() {
    if (!find) return;
    deleteMutation.mutate(
      { findId: find.id, deleteFiles },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <AlertDialog open={find !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {find ? (find.species_name || find.original_filename) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={deleteFiles ? 'files' : 'record'}
          onValueChange={(val) => setDeleteFiles(val === 'files')}
          className="gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="record" id="delete-record-only" />
            <Label htmlFor="delete-record-only">{t('delete.recordOnly')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="files" id="delete-record-files" />
            <Label htmlFor="delete-record-files">{t('delete.recordAndFiles')}</Label>
          </div>
        </RadioGroup>

        {deleteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : t('delete.confirm')}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? t('delete.deleting') : t('delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
