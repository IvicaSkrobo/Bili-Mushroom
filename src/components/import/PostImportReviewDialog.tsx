import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import type { ImportSummary, Find } from '@/lib/finds';

interface PostImportReviewDialogProps {
  summary: ImportSummary | null;
  onOpenChange: (open: boolean) => void;
}

export function PostImportReviewDialog({ summary, onOpenChange }: PostImportReviewDialogProps) {
  const [editingFind, setEditingFind] = useState<Find | null>(null);

  const open = summary !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Import complete — {summary?.imported.length ?? 0} imported
              {(summary?.skipped.length ?? 0) > 0 && `, ${summary!.skipped.length} skipped`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[50vh]">
            {/* Imported finds list */}
            {summary && summary.imported.length > 0 && (
              <div className="space-y-2 p-1">
                <p className="text-sm font-medium text-muted-foreground">Imported</p>
                {summary.imported.map((find) => (
                  <div
                    key={find.id}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">
                        {find.species_name || find.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">{find.date_found}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingFind(find)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped files */}
            {summary && summary.skipped.length > 0 && (
              <div className="space-y-1 p-1 mt-3">
                <p className="text-sm font-medium text-muted-foreground">Skipped</p>
                {summary.skipped.map((path, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">{path}</p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline edit for a find from the review list */}
      <EditFindDialog
        find={editingFind}
        onOpenChange={(open) => !open && setEditingFind(null)}
      />
    </>
  );
}
