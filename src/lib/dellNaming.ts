/**
 * Dell Monitor Series Naming Convention
 * Properly formats brief names for Dell monitors
 */

interface DellSeriesMapping {
  code: string;
  seriesName: string;
  monitorType: string;
}

const DELL_SERIES: DellSeriesMapping[] = [
  { code: 'SE', seriesName: 'SE Series', monitorType: 'LED Monitor' },
  { code: 'S', seriesName: 'S Series', monitorType: 'LED Monitor' },
  { code: 'P', seriesName: 'P Series', monitorType: 'Monitor' },
  { code: 'U', seriesName: 'UltraSharp', monitorType: 'Monitor' },
  { code: 'E', seriesName: 'E Series', monitorType: 'Monitor' },
  { code: 'G', seriesName: 'Gaming Series', monitorType: 'Monitor' },
  { code: 'AW', seriesName: 'Alienware', monitorType: 'Gaming Monitor' },
];

/**
 * Format Dell monitor brief name according to series naming convention
 * @param model - Dell model code (e.g., "SE2225HM", "U2424H", "P2722HE")
 * @param size - Screen size (e.g., "24 Inch", "27 Inch")
 * @returns Properly formatted brief name (e.g., "DELL SE SERIES LED MONITOR")
 */
export function formatDellBriefName(model: string, size?: string): string {
  if (!model) {
    return 'DELL Monitor';
  }

  const modelUpper = model.toUpperCase();

  // Extract series code from model
  let seriesCode = '';
  let seriesInfo: DellSeriesMapping | undefined;

  // Check for two-letter codes first (AW, SE, etc.)
  for (const series of DELL_SERIES) {
    if (modelUpper.startsWith(series.code)) {
      seriesCode = series.code;
      seriesInfo = series;
      break;
    }
  }

  // If no series found, default to basic naming
  if (!seriesInfo) {
    return `DELL ${modelUpper} Monitor`;
  }

  // Format according to Dell naming convention
  // Example: "DELL SE SERIES LED MONITOR" or "DELL ULTRASHARP MONITOR"
  const briefName = `DELL ${seriesInfo.seriesName.toUpperCase()} ${seriesInfo.monitorType.toUpperCase()}`;

  return briefName;
}

/**
 * Extract size from brief name or product description
 * @param text - Product text to search
 * @returns Size string (e.g., "24 Inch") or empty string
 */
export function extractSizeFromText(text: string): string {
  const match = text.match(/(\d+(?:\.\d+)?)\s*["']/);
  if (match) {
    return `${match[1]} Inch`;
  }
  return "";
}

/**
 * Improve brief name for Dell products
 * @param currentBriefName - Current brief name
 * @param model - Model code
 * @returns Improved brief name
 */
export function improveDellBriefName(currentBriefName: string, model: string): string {
  if (!model || !currentBriefName) {
    return currentBriefName;
  }

  // Check if it's a Dell monitor
  const modelUpper = model.toUpperCase();
  const briefNameUpper = currentBriefName.toUpperCase();

  if (!briefNameUpper.includes('DELL')) {
    return currentBriefName;
  }

  // Use the proper Dell naming convention
  return formatDellBriefName(model);
}

// Example usage (commented out for ES module compatibility)
/*
console.log('Dell Naming Convention Examples:');
console.log('=================================');

const testModels = [
  'SE2225HM',
  'U2424H',
  'P2722HE',
  'S2425H',
  'E2425HM',
  'AW3423DW'
];

testModels.forEach(model => {
  const formatted = formatDellBriefName(model);
  console.log(`${model.padEnd(12)} → ${formatted}`);
});
*/

export {};
