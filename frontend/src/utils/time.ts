/**
 * Utility for parsing UTC timestamps from Python/SQLite backend
 * and formatting accurately in Indian Standard Time (IST - Asia/Kolkata, UTC+05:30).
 */

export const parseUtcDate = (dateInput: string | Date | null | undefined): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;

  let s = String(dateInput).trim();
  if (!s) return null;

  // Replace SQL space separator with standard ISO 'T'
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }

  // If timestamp has no timezone indicator (naive UTC from Python), append 'Z'
  const hasTimezone = s.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(s);
  if (!hasTimezone) {
    s += 'Z';
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Format to Indian Standard Time (hh:mm:ss AM/PM IST)
 */
export const formatISTTime = (dateInput: string | Date | null | undefined): string => {
  const d = parseUtcDate(dateInput);
  if (!d) return 'N/A';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
};

/**
 * Format to Indian Standard Time short (hh:mm AM/PM IST)
 */
export const formatISTShortTime = (dateInput: string | Date | null | undefined): string => {
  const d = parseUtcDate(dateInput);
  if (!d) return 'N/A';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' IST';
};

/**
 * Format to Indian Standard DateTime (DD/MM/YYYY, hh:mm:ss AM/PM IST)
 */
export const formatISTDateTime = (dateInput: string | Date | null | undefined): string => {
  const d = parseUtcDate(dateInput);
  if (!d) return 'N/A';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
};
