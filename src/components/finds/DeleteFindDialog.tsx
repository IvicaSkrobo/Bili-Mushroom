import { useState, useEffect } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useDeleteFind, useMoveFindToFolder } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';
import type { Find } from '@/lib/finds';

type DeleteMode = 'record' | 'files' | 'move';

interface DeleteFindDialogProps {
  find: Find | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteFindDialog({ find, onOpenChange }: DeleteFindDialogProps) {
  const t = useT();
  const [mode, setMode] = useState<DeleteMode>('record');
  const [destFolder, setDestFolder] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const deleteMutation = useDeleteFind();
  const moveMutation = useMoveFindToFolder();

  useEffect(() => {
    setMode('record');
    setDestFolder(null);
  }, [find]);

  async function handlePickFolder() {
    setPickingFolder(true);
    try {
      const dir = await openDialog({ directory: true, multiple: false });
      if (dir && typeof dir === 'string') setDestFolder(dir);
    } finally {
      setPickingFolder(false);
    }
  }

  async function handleConfirm() {
    if (!find) return;
    if (mode === 'move') {
      if (!destFolder) return;
      moveMutation.mutate(
        { findId: find.id, destFolder },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      deleteMutation.mutate(
        { findId: find.id, deleteFiles: mode === 'files' },
        {
          onSuccess: () => {
            toast.success(mode === 'files' ? t('delete.successFiles') : t('delete.successRecord'));
            onOpenChange(false);
          },
        },
      );
    }
  }

  const isPending = deleteMutation.isPending || moveMutation.isPending;
  const isError = deleteMutation.isError || moveMutation.isError;
  const errorMsg = (deleteMutation.error ?? moveMutation.error) instanceof Error
    ? (deleteMutation.error ?? moveMutation.error as Error).message
    : t('delete.confirm');

  const confirmDisabled = isPending || (mode === 'move' && !destFolder);

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
          value={mode}
          onValueChange={(val) => { setMode(val as DeleteMode); setDestFolder(null); }}
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
          <div className="flex items-center gap-2">
            <RadioGroupItem value="move" id="delete-move-files" />
            <Label htmlFor="delete-move-files">{t('delete.moveFiles')}</Label>
          </div>
        </RadioGroup>

        {mode === 'move' && (
          <div className="flex items-center gap-2 pl-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePickFolder}
              disabled={pickingFolder}
            >
              {destFolder ? t('delete.folderSelected') : t('delete.chooseDestFolder')}
            </Button>
            {destFolder && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={destFolder}>
                {destFolder.split(/[\\/]/).pop()}
              </span>
            )}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={confirmDisabled}>
            {isPending
              ? (mode === 'move' ? t('delete.moving') : t('delete.deleting'))
              : t('delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
