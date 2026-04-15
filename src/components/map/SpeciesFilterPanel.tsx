import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface SpeciesFilterPanelProps {
  allSpecies: string[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
}

export function SpeciesFilterPanel({ allSpecies, selected, onToggle, onSelectAll }: SpeciesFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isAll = selected.size === 0;
  const filtered = search.trim()
    ? allSpecies.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
    : allSpecies;

  return (
    <div className="absolute bottom-8 left-3 z-[1001] font-sans select-none">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-md transition-colors"
        style={{
          background: 'oklch(0.15 0.02 135)',
          color: '#F5E6C8',
          border: `1px solid ${selected.size > 0 ? '#D4941A' : 'rgba(212,148,26,0.4)'}`,
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {selected.size > 0 ? `${selected.size} selected` : 'All species'}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="mb-1.5 w-60 rounded-md shadow-xl absolute bottom-full left-0"
          style={{
            background: 'oklch(0.15 0.02 135)',
            border: '1px solid rgba(212,148,26,0.35)',
            color: '#F5E6C8',
          }}
        >
          {/* Search */}
          <div className="relative px-3 pt-3 pb-2">
            <Search
              className="pointer-events-none absolute left-5 top-[18px] h-3.5 w-3.5 opacity-40"
              style={{ color: '#F5E6C8' }}
            />
            <input
              type="text"
              placeholder="Search species…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded py-1.5 pl-6 pr-6 text-xs outline-none placeholder:opacity-40"
              style={{
                background: 'oklch(0.10 0.01 135)',
                color: '#F5E6C8',
                border: '1px solid rgba(212,148,26,0.2)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-5 top-[18px] opacity-40 hover:opacity-70"
              >
                <X className="h-3 w-3" style={{ color: '#F5E6C8' }} />
              </button>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(212,148,26,0.2)' }} />

          {/* See all */}
          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5">
            <input
              type="checkbox"
              checked={isAll}
              onChange={onSelectAll}
              className="accent-amber-500 h-3.5 w-3.5"
            />
            <span className="font-semibold" style={{ color: '#D4941A' }}>
              See all ({allSpecies.length})
            </span>
          </label>

          <div style={{ borderTop: '1px solid rgba(212,148,26,0.15)' }} />

          {/* Species list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs opacity-40">No results</p>
            )}
            {filtered.map((name) => {
              const [latin, croatian] = name.split(',').map((s) => s.trim());
              return (
                <label
                  key={name}
                  className="flex cursor-pointer items-start gap-2.5 px-3 py-1.5 text-xs hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={!isAll && selected.has(name)}
                    onChange={() => onToggle(name)}
                    className="accent-amber-500 mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span className="leading-snug">
                    <span className="italic" style={{ color: '#F5E6C8' }}>{latin}</span>
                    {croatian && (
                      <span className="block opacity-55" style={{ color: '#F5E6C8' }}>{croatian}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
