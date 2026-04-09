import { Search } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';

export default function BrowseTab() {
  return (
    <EmptyState
      icon={Search}
      heading="Nothing to browse yet"
      body="Start building your collection to browse and filter your finds."
    />
  );
}
