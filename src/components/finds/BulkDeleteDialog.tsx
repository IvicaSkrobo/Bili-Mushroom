import { useState } from 'react';
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
import { useBulkDeleteFinds, useBulkMoveFindToFolder } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';

type DeleteMode = 'record' | 'files' | 'move';

interface BulkDeleteDialogProps {
  count: number;
  findIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkDeleteDialog({ count, findIds, open, onOpenChange, onSuccess }: BulkDeleteDialogProps) {
  const t = useT();
  const [mode, setMode] = useState<DeleteMode>('record');
  const [destFolder, setDestFolder] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const bulkDelete = useBulkDeleteFinds();
  const bulkMove = useBulkMoveFindToFolder();

  async function handlePickFolder() {
    setPickingFolder(true);
    try {
      const dir = await openDialog({ directory: true, multiple: false });
      if (dir && typeof dir === 'string') setDestFolder(dir);
    } finally {
      setPickingFolder(false);
    }
  }

  function handleConfirm() {
    if (mode === 'move') {
      if (!destFolder) return;
      bulkMove.mutate(
        { findIds, destFolder },
        { onSuccess: () => { onOpenChange(false); onSuccess(); } },
      );
    } else {
      bulkDelete.mutate(
        { findIds, deleteFiles: mode === 'files' },
        { onSuccess: () => { onOpenChange(false); onSuccess(); } },
      );
    }
  }

  const isPending = bulkDelete.isPending || bulkMove.isPending;
  const isError = bulkDelete.isError || bulkMove.isError;
  const errorMsg = (bulkDelete.error ?? bulkMove.error) instanceof Error
    ? (bulkDelete.error ?? bulkMove.error as Error).message
    : t('delete.confirm');

  const confirmDisabled = isPending || (mode === 'move' && !destFolder);

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
          value={mode}
          onValueChange={(val) => { setMode(val as DeleteMode); setDestFolder(null); }}
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
          <div className="flex items-center gap-2">
            <RadioGroupItem value="move" id="bulk-delete-move-files" />
            <Label htmlFor="bulk-delete-move-files">{t('delete.moveFiles')}</Label>
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
