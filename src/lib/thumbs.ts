/**
 * Pseudo-random duration label derived from an id (deterministic).
 * Used only as a cosmetic fallback for legacy http thumbnails.
 */
export function durationFor(id: number): string {
  const secs = 18 + (Math.abs(id) * 37) % 160;
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}
