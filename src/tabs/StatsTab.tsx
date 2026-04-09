import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';

export default function StatsTab() {
  return (
    <EmptyState
      icon={BarChart3}
      heading="No stats yet"
      body="Your foraging stats will appear here once you have finds in your collection."
    />
  );
}
