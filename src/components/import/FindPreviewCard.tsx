import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image, MapPin, X, Unlock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { isHeic, type ImportPayload } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import type { LockableField } from './ImportDialog';

interface FindPreviewCardProps {
  payload: ImportPayload;
  sourcePath: string;
  locked: Partial<Record<LockableField, boolean>>;
  onChange: (updated: ImportPayload, lockField?: LockableField) => void;
  onUnlock: (field: LockableField) => void;
  onRemove: () => void;
}

export function FindPreviewCard({
  payload,
  sourcePath,
  locked,
  onChange,
  onUnlock,
  onRemove,
}: FindPreviewCardProps) {
  const [mapOpen, setMapOpen] = useState(false);

  /** Update a field and auto-lock it (user manually edited this card). */
  const updateLockable = <K extends LockableField>(key: K, value: string) => {
    onChange({ ...payload, [key]: value }, key);
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    onChange({ ...payload, lat, lng });
    const geo = await reverseGeocode(lat, lng);
    if (geo.country || geo.region) {
      onChange({ ...payload, lat, lng, country: geo.country, region: geo.region }, 'country');
    }
  };

  const isHeicFile = isHeic(payload.original_filename);

  /** Renders a lockable field row. When locked, shows an "Allow override" unlock button. */
  function LockableInput({
    field,
    ...inputProps
  }: { field: LockableField } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="flex items-center gap-1">
        <Input
          {...inputProps}
          value={payload[field] as string}
          onChange={(e) => updateLockable(field, e.target.value)}
          className={locked[field] ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
        />
        {locked[field] && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-amber-500 hover:text-amber-700"
            title="Allow shared header to override this field"
            onClick={() => onUnlock(field)}
          >
            <Unlock className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className="relative">
        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardContent className="pt-4">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              {isHeicFile ? (
                <div className="h-24 w-24 flex flex-col items-center justify-center rounded bg-muted text-muted-foreground text-xs text-center p-1">
                  <Image className="h-8 w-8 mb-1" />
                  <span>HEIC preview not supported</span>
                </div>
              ) : (
                <img
                  src={convertFileSrc(sourcePath)}
                  alt={payload.original_filename}
                  className="h-24 w-24 object-cover rounded"
                />
              )}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-2 pr-8">
              <div className="col-span-2">
                <Input
                  placeholder="Species name"
                  value={payload.species_name}
                  onChange={(e) => onChange({ ...payload, species_name: e.target.value })}
                />
              </div>

              <div>
                <LockableInput field="date_found" type="date" />
                {payload.date_found === '' && (
                  <p className="text-xs text-destructive mt-1">Date required before import</p>
                )}
              </div>

              <div>
                <LockableInput field="country" placeholder="Country" />
              </div>

              <div>
                <LockableInput field="region" placeholder="Region" />
              </div>

              <div>
                <LockableInput field="location_note" placeholder="Location mark" />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Pick on map"
                  onClick={() => setMapOpen(true)}
                  title="Pick on map"
                  className={payload.lat !== null && payload.lng !== null ? 'text-green-600 border-green-600' : ''}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  {payload.lat !== null && payload.lng !== null
                    ? `${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`
                    : 'Set location'}
                </Button>
              </div>

              <div className="col-span-2">
                <Textarea
                  placeholder="Notes"
                  rows={2}
                  value={payload.notes}
                  onChange={(e) => onChange({ ...payload, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <LocationPickerMap
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLatLng={
          payload.lat !== null && payload.lng !== null
            ? { lat: payload.lat, lng: payload.lng }
            : null
        }
        onConfirm={handleMapConfirm}
      />
    </>
  );
}
