import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface MigrationErrorDialogProps {
  errorMessage: string;
  onQuit: () => void;
}

export function MigrationErrorDialog({ errorMessage, onQuit }: MigrationErrorDialogProps) {
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
            Bili Mushroom encountered a problem updating its database. Details are shown below.
            Please contact support or check the log file before retrying.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-48 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {errorMessage}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled>Open Log File</Button>
          <Button variant="destructive" onClick={onQuit}>Quit App</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
