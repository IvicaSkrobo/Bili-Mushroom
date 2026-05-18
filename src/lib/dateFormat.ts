import type { Lang } from '@/i18n/index';

export function formatDisplayDate(date: string | null | undefined, lang: Lang | string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  if (lang === 'hr') {
    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
  }

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(parsed);
}

export function formatCroatianDateInput(date: string | null | undefined): string {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
}

export function parseDateInputToIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return normalizeIsoParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const parts = raw.split(/[.\-/\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;

  const [day, month, yearRaw] = parts;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return normalizeIsoParts(year, month, day);
}

function normalizeIsoParts(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
