import { GalleryHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';

export default function CollectionTab() {
  return (
    <EmptyState
      icon={GalleryHorizontal}
      heading="Your collection is empty"
      body="Import your first mushroom find to get started."
    />
  );
}
