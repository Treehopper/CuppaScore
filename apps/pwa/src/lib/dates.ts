/** Local calendar date YYYY-MM-DD of the device (for date inputs and "today"). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** −1 … +1 preference → −100 … +100 display score (README §5.5). */
export const displayScore = (p: number): number => Math.round(p * 100);
