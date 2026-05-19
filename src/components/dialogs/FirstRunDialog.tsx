import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pickAndSaveStoragePath } from '@/lib/storage';
import { useT, type Lang } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';

export interface FirstRunDialogProps {
  onFolderSelected: (path: string) => void;
}

export function FirstRunDialog({ onFolderSelected }: FirstRunDialogProps) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
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
        <div className="rounded-md border border-border/70 bg-card/50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t('firstRun.language')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['hr', 'en'] as Lang[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  language === lang
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background/80 text-foreground hover:border-primary/60 hover:text-primary'
                }`}
              >
                {lang === 'hr' ? t('settings.langHr') : t('settings.langEn')}
              </button>
            ))}
          </div>
        </div>
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
