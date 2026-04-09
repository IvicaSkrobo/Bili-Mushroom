import { useState } from 'react';
import { GalleryHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/ImportDialog';

// Temporary scaffold: Import Photos button wired to ImportDialog.
// Plan 03 will replace this entire tab with the full find list view.
export default function CollectionTab() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <div className="p-4">
        <Button onClick={() => setImportOpen(true)}>Import Photos</Button>
      </div>
      <EmptyState
        icon={GalleryHorizontal}
        heading="Your collection is empty"
        body="Import your first mushroom find to get started."
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
