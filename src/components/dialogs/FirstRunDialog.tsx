import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pickAndSaveStoragePath } from '@/lib/storage';
import { useT } from '@/i18n/index';

export interface FirstRunDialogProps {
  onFolderSelected: (path: string) => void;
}

export function FirstRunDialog({ onFolderSelected }: FirstRunDialogProps) {
  const t = useT();
  const [picking, setPicking] = useState(false);

  async function handleChoose() {
    setPicking(true);
    try {
      const folder = await pickAndSaveStoragePath();
      if (folder) onFolderSelected(folder);
    } finally {
      setPicking(false);
    }
  }

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
            <Sprout className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-2xl font-semibold">
            {t('firstRun.title')}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {t('firstRun.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          {t('firstRun.noFolder')}
        </div>
        <Button onClick={handleChoose} disabled={picking} className="w-full">
          {t('firstRun.chooseFolder')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
