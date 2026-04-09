import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppStore } from '@/stores/appStore';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);

  function handleChangeFolder() {
    // TODO(phase 2): wire change-folder flow with move/copy prompt per D-02
    console.log('Change folder — Phase 2 feature');
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
          <Button variant="secondary" onClick={handleChangeFolder}>Change Folder</Button>
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
