import { useState } from 'react';
import { GalleryHorizontal, Plus } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImportDialog } from '@/components/import/ImportDialog';
import { FindCard } from '@/components/finds/FindCard';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { DeleteFindDialog } from '@/components/finds/DeleteFindDialog';
import { useFinds } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import type { Find } from '@/lib/finds';

export default function CollectionTab() {
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds, isLoading, isError, error } = useFinds();
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Find | null>(null);
  const [deleting, setDeleting] = useState<Find | null>(null);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setImportOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Import Photos
        </Button>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading finds…</p>}
      {isError && (
        <Alert variant="destructive">
          <AlertDescription>{String(error)}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !isError && (finds?.length ?? 0) === 0 && (
        <EmptyState
          icon={GalleryHorizontal}
          heading="Your collection is empty"
          body="Import your first mushroom find to get started."
        />
      )}
      {!isLoading && finds && finds.length > 0 && (
        <div className="grid gap-3">
          {finds.map((f) => (
            <FindCard
              key={f.id}
              find={f}
              storagePath={storagePath!}
              onEdit={() => setEditing(f)}
              onDelete={() => setDeleting(f)}
            />
          ))}
        </div>
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <EditFindDialog
        find={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteFindDialog
        find={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
