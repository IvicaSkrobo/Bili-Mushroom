import { MapPin } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';

export default function MapTab() {
  return (
    <EmptyState
      icon={MapPin}
      heading="No finds on the map yet"
      body="Your mushroom finds will appear here once you start importing."
    />
  );
}
