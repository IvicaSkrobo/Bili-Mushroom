import { convertFileSrc } from '@tauri-apps/api/core';
import { Image, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { isHeic, type ImportPayload } from '@/lib/finds';

interface FindPreviewCardProps {
  payload: ImportPayload;
  sourcePath: string;
  onChange: (updated: ImportPayload) => void;
  onRemove: () => void;
}

export function FindPreviewCard({
  payload,
  sourcePath,
  onChange,
  onRemove,
}: FindPreviewCardProps) {
  const updateField = <K extends keyof ImportPayload>(key: K, value: ImportPayload[K]) => {
    onChange({ ...payload, [key]: value });
  };

  const handleLatChange = (raw: string) => {
    const parsed = parseFloat(raw);
    updateField('lat', raw === '' || isNaN(parsed) ? null : parsed);
  };

  const handleLngChange = (raw: string) => {
    const parsed = parseFloat(raw);
    updateField('lng', raw === '' || isNaN(parsed) ? null : parsed);
  };

  const isHeicFile = isHeic(payload.original_filename);

  return (
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
                onChange={(e) => updateField('species_name', e.target.value)}
              />
            </div>

            <div>
              <Input
                type="date"
                value={payload.date_found}
                onChange={(e) => updateField('date_found', e.target.value)}
              />
              {payload.date_found === '' && (
                <p className="text-xs text-destructive mt-1">Date required before import</p>
              )}
            </div>

            <div className="col-span-1">
              <Input
                placeholder="Country"
                value={payload.country}
                onChange={(e) => updateField('country', e.target.value)}
              />
            </div>

            <div>
              <Input
                placeholder="Region"
                value={payload.region}
                onChange={(e) => updateField('region', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="any"
                placeholder="Latitude"
                value={payload.lat ?? ''}
                onChange={(e) => handleLatChange(e.target.value)}
              />
              <Input
                type="number"
                step="any"
                placeholder="Longitude"
                value={payload.lng ?? ''}
                onChange={(e) => handleLngChange(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <Textarea
                placeholder="Notes"
                rows={2}
                value={payload.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
