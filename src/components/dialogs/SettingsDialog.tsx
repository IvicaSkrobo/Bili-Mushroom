import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppStore } from '@/stores/appStore';
import { pickAndSaveStoragePath } from '@/lib/storage';
import { initializeDatabase } from '@/lib/db';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const setStoragePath = useAppStore((s) => s.setStoragePath);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setDbError = useAppStore((s) => s.setDbError);
  const [picking, setPicking] = useState(false);

  async function handleChangeFolder() {
    setPicking(true);
    try {
      const folder = await pickAndSaveStoragePath();
      if (!folder) return;
      setDbReady(false);
      setStoragePath(folder);
      await initializeDatabase(folder);
      setDbReady(true);
      onOpenChange(false);
    } catch (err) {
      setDbError(String((err as Error)?.message ?? err));
    } finally {
      setPicking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Mushroom Library Location</div>
          <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {storagePath ?? '(not set)'}
          </div>
          <Button variant="secondary" onClick={handleChangeFolder} disabled={picking}>
            {picking ? 'Choosing…' : 'Change Folder'}
          </Button>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Changing your library folder will ask whether to move or copy your existing data.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
