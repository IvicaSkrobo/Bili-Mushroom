import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/index';

interface PickLocationButtonProps {
  hasLocation: boolean;
  lat?: number | null;
  lng?: number | null;
  onClick: () => void;
}

export function PickLocationButton({ hasLocation, lat, lng, onClick }: PickLocationButtonProps) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={[
          'gap-1.5 h-8 border',
          hasLocation
            ? 'border-secondary/50 bg-secondary/15 text-secondary hover:bg-secondary/25 hover:border-secondary/65'
            : 'border-primary/40 bg-primary/12 text-primary hover:bg-primary/22 hover:border-primary/60',
        ].join(' ')}
      >
        <MapPin className="h-3.5 w-3.5" />
        {t('folder.pickOnMap')}
      </Button>
      {hasLocation && lat != null && lng != null && (
        <span className="text-xs font-mono text-muted-foreground">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      )}
    </div>
  );
}
