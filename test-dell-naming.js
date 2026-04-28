// Test Dell naming function
const DELL_SERIES = [
  { code: 'SE', seriesName: 'SE Series', monitorType: 'LED Monitor' },
  { code: 'S', seriesName: 'S Series', monitorType: 'LED Monitor' },
  { code: 'P', seriesName: 'P Series', monitorType: 'Monitor' },
  { code: 'U', seriesName: 'UltraSharp', monitorType: 'Monitor' },
  { code: 'E', seriesName: 'E Series', monitorType: 'Monitor' },
  { code: 'G', seriesName: 'Gaming Series', monitorType: 'Monitor' },
  { code: 'AW', seriesName: 'Alienware', monitorType: 'Gaming Monitor' },
];

function formatDellBriefName(model) {
  if (!model) {
    return 'DELL Monitor';
  }

  const modelUpper = model.toUpperCase();

  // Extract series code from model
  let seriesCode = '';
  let seriesInfo;

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
  const briefName = `DELL ${seriesInfo.seriesName.toUpperCase()} ${seriesInfo.monitorType.toUpperCase()}`;

  return briefName;
}

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
    const current = `Dell 22 Monitor - ${model}`; // Example current format
    console.log(`\nModel: ${model}`);
    console.log(`  Current:  ${current}`);
    console.log(`  Improved: ${formatted}`);
  });

  console.log('\n=================================');
  console.log(`SE2225HM Warranty: "1 Year Limited Hardware and Advanced Exchange Service"`);
