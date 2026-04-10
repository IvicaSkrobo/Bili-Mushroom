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
import { toast } from 'sonner';
import { useDeleteFind } from '@/hooks/useFinds';
import type { Find } from '@/lib/finds';

interface DeleteFindDialogProps {
  find: Find | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteFindDialog({ find, onOpenChange }: DeleteFindDialogProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const deleteMutation = useDeleteFind();

  // Reset to record-only whenever a new find is set
  useEffect(() => {
    setDeleteFiles(false);
  }, [find]);

  async function handleConfirm() {
    if (!find) return;
    deleteMutation.mutate(
      { findId: find.id, deleteFiles },
      {
        onSuccess: () => {
          toast.success(deleteFiles ? 'Find and files deleted' : 'Find deleted');
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <AlertDialog open={find !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete find?</AlertDialogTitle>
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
            <Label htmlFor="delete-record-only">
              Delete record only — keep photo file on disk
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="files" id="delete-record-files" />
            <Label htmlFor="delete-record-files">
              Delete record + files — move photo to Recycle Bin
            </Label>
          </div>
        </RadioGroup>

        {deleteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Delete failed'}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
