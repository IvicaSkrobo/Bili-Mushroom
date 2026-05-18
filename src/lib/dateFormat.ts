import type { Lang } from '@/i18n/index';

export function formatDisplayDate(date: string | null | undefined, lang: Lang | string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  if (lang === 'hr') {
    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
  }

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(parsed);
}
