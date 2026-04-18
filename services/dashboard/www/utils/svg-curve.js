/**
 * SVG curve geometry helpers.
 *
 * Pure functions only. No Alpine, no DOM, no module side effects.
 * Used by the weather view for hourly and 10-day curves.
 */

/**
 * Catmull-Rom -> cubic Bezier smoothed path for an ordered series of points.
 * @param {{x:number,y:number}[]} pts - at least 2 points in draw order.
 * @returns {string} SVG path `d` attribute value. Empty string if <2 points.
 */
export function smoothPath(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Linear horizontal scale for `n` evenly-spaced points across an inner width.
 * @param {number} i - zero-based index (0..n-1).
 * @param {number} n - total number of points.
 * @param {number} width - overall width of the SVG viewBox.
 * @param {number} padX - horizontal inset on each side.
 * @returns {number} x coordinate in viewBox units.
 */
export function xScale(i, n, width, padX) {
  if (n <= 1) return width / 2;
  const innerW = width - padX * 2;
  return padX + (i * innerW) / (n - 1);
}

/**
 * Linear vertical scale for a value within [min, max], inverted so larger
 * values sit higher in the viewBox (smaller y).
 * @param {number} v - value to place.
 * @param {number} min - lower bound of the value range.
 * @param {number} max - upper bound of the value range.
 * @param {number} height - overall height of the SVG viewBox.
 * @param {number} padTop - top inset.
 * @param {number} padBottom - bottom inset.
 * @returns {number} y coordinate in viewBox units.
 */
export function yScale(v, min, max, height, padTop, padBottom) {
  const innerH = height - padTop - padBottom;
  if (max === min) return padTop + innerH / 2;
  return padTop + (1 - (v - min) / (max - min)) * innerH;
}
