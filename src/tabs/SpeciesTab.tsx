import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';

export default function SpeciesTab() {
  return (
    <EmptyState
      icon={BookOpen}
      heading="Species database"
      body="The built-in species guide will be available here."
    />
  );
}
