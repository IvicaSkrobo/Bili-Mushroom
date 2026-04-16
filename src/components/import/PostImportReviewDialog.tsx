import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { useAppStore } from '@/stores/appStore';
import { deleteFind } from '@/lib/finds';
import type { ImportSummary, Find } from '@/lib/finds';
import { useT } from '@/i18n/index';

interface PostImportReviewDialogProps {
  summary: ImportSummary | null;
  onOpenChange: (open: boolean) => void;
  onImportMore?: () => void;
}

export function PostImportReviewDialog({ summary, onOpenChange, onImportMore }: PostImportReviewDialogProps) {
  const t = useT();
  const [editingFind, setEditingFind] = useState<Find | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const storagePath = useAppStore((s) => s.storagePath);

  const open = summary !== null;

  async function handleDelete(find: Find) {
    if (!storagePath) return;
    try {
      await deleteFind(storagePath, find.id, false);
      setDeletedIds((prev) => new Set(prev).add(find.id));
    } catch {
      // silently ignore — find may already be gone
    }
  }

  const visibleFinds = summary?.imported.filter((f) => !deletedIds.has(f.id)) ?? [];
  const visiblePhotoCount = visibleFinds.reduce((sum, find) => sum + Math.max(find.photos?.length ?? 0, 1), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {t('import.reviewTitle', { finds: visibleFinds.length, photos: visiblePhotoCount })}
              {(summary?.skipped.length ?? 0) > 0 && t('import.reviewSkipped', { n: summary!.skipped.length })}
              {deletedIds.size > 0 && t('import.reviewDeleted', { n: deletedIds.size })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[50vh]">
            {/* Imported finds list */}
            {visibleFinds.length > 0 && (
              <div className="space-y-2 p-1">
                <p className="text-sm font-medium text-muted-foreground">{t('import.reviewImportedSection')}</p>
                {visibleFinds.map((find) => {
                  const primaryPhoto = find.photos?.[0];
                  const thumbSrc = primaryPhoto && storagePath
                    ? convertFileSrc(`${storagePath}/${primaryPhoto.photo_path}`)
                    : null;

                  return (
                    <div
                      key={find.id}
                      className="flex items-center gap-3 rounded border px-3 py-2"
                    >
                      {/* Thumbnail */}
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt=""
                          className="h-12 w-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(find)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Skipped files */}
            {summary && summary.skipped.length > 0 && (
              <div className="space-y-1 p-1 mt-3">
                <p className="text-sm font-medium text-muted-foreground">{t('import.reviewSkippedSection')}</p>
                {summary.skipped.map((path, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">{path}</p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {onImportMore && (
              <Button variant="outline" onClick={onImportMore}>
                {t('import.importMore')}
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditFindDialog
        find={editingFind}
        onOpenChange={(open) => !open && setEditingFind(null)}
      />
    </>
  );
}
