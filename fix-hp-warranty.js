/**
 * Fix HP Monitor Warranty from 1 Year to 3 Years
 * HP business monitors typically come with 3-year warranties
 */

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/hp_monitors.json', 'utf-8'));

console.log('🔧 Fixing HP Monitor Warranty Information');
console.log('='.repeat(60));

let fixedCount = 0;

const fixedData = data.map(item => {
  if (item['Warranty'] === '1 Year Warranty') {
    console.log(`✅ Updating ${item.Model}: "1 Year Warranty" → "3 Years Warranty"`);
    fixedCount++;
    return {
      ...item,
      'Warranty': '3 Years Warranty'
    };
  }
  return item;
});

console.log('\n' + '='.repeat(60));
console.log(`📊 Fixed ${fixedCount} HP monitor warranties`);
console.log('='.repeat(60));

// Write updated data
fs.writeFileSync('public/hp_monitors.json', JSON.stringify(fixedData, null, 2), 'utf-8');
console.log('\n✅ All HP monitor warranties updated to 3 Years!');

// Show verification
console.log('\n🔍 Verification - Sample HP Monitors:');
const samples = ['322pv', '324pv', '327ph', '527pf', 'E24mq'];
samples.forEach(model => {
  const monitor = fixedData.find(m => m.Model === model);
  if (monitor) {
    console.log(`   ${monitor.Model}: "${monitor.Warranty}"`);
  }
});
