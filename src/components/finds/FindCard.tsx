import { convertFileSrc } from '@tauri-apps/api/core';
import { Pencil, Image } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isHeic, type Find } from '@/lib/finds';

interface FindCardProps {
  find: Find;
  storagePath: string;
  onEdit: (find: Find) => void;
}

export function FindCard({ find, storagePath, onEdit }: FindCardProps) {
  const absolutePath = `${storagePath}/${find.photo_path}`;
  const heic = isHeic(find.photo_path);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-3">
        {/* Thumbnail */}
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
          {heic ? (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Image className="h-8 w-8" />
              <span className="text-xs">HEIC</span>
            </div>
          ) : (
            <img
              src={convertFileSrc(absolutePath)}
              alt={find.original_filename}
              className="h-20 w-20 object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="font-semibold truncate">
            {find.species_name || '(unnamed)'}
          </p>
          <p className="text-sm text-muted-foreground">{find.date_found}</p>
          <p className="text-sm text-muted-foreground">
            {find.country} / {find.region}
          </p>
          {(find.lat !== null && find.lng !== null) && (
            <p className="text-xs text-muted-foreground">
              {find.lat?.toFixed(4)}, {find.lng?.toFixed(4)}
            </p>
          )}
        </div>

        {/* Edit button */}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Edit"
          onClick={() => onEdit(find)}
        >
          <Pencil className="h-4 w-4" />
          <span className="ml-1">Edit</span>
        </Button>
      </CardContent>
    </Card>
  );
}
