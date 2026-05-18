import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';

export interface BulkFields {
  species_name?: string;
  date_found?: string;
  country?: string;
}

interface BulkMetadataBarProps {
  itemCount: number;
  onApplyAll: (fields: BulkFields) => void;
}

export function BulkMetadataBar({ itemCount, onApplyAll }: BulkMetadataBarProps) {
  const [species, setSpecies] = useState('');
  const [date, setDate] = useState('');
  const [country, setCountry] = useState('');

  if (itemCount < 2) return null;

  function handleApply() {
    const fields: BulkFields = {};
    if (species.trim()) fields.species_name = species.trim();
    if (date) fields.date_found = date;
    if (country.trim()) fields.country = country.trim();
    onApplyAll(fields);
    setSpecies('');
    setDate('');
    setCountry('');
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border bg-muted/30 p-3">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        Apply to all {itemCount} cards:
      </span>
      <Input
        className="w-40"
        placeholder="Species name"
        value={species}
        onChange={(e) => setSpecies(e.target.value)}
      />
      <DateInput
        className="w-36"
        value={date}
        onChange={setDate}
        aria-label="Date"
      />
      <Input
        className="w-32"
        placeholder="Country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      />
      <Button variant="outline" size="sm" onClick={handleApply}>
        Apply to all
      </Button>
    </div>
  );
}
