import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface MigrationErrorDialogProps {
  errorMessage: string;
  onReset: () => void;
}

export function MigrationErrorDialog({ errorMessage, onReset }: MigrationErrorDialogProps) {
  return (
    <Dialog open={true}>
      <DialogContent
        className="w-[480px] max-w-[480px]"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold">Database Error</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Bili Mushroom encountered a problem with the database. You can try a different
            folder or quit and restart the app.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-48 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {errorMessage}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onReset}>Try Again</Button>
          <Button variant="destructive" onClick={() => invoke('quit_app')}>Quit App</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
