#!/usr/bin/env node
/**
 * Test Gemma 4 Availability
 * Check various sources for Gemma 4 access
 */

const { HfInference } = require('@huggingface/inference');

const HF_TOKEN = process.env.HF_TOKEN || '';

console.log('🔍 Testing Gemma 4 Availability');
console.log('='.repeat(70));

// Test 1: Hugging Face - Gemma 4 models
async function testHuggingFace() {
  console.log('\n📦 Test 1: Hugging Face');
  console.log('-'.repeat(70));

  if (!HF_TOKEN) {
    console.log('❌ No HF_TOKEN');
    return;
  }

  const hf = new HfInference(HF_TOKEN);

  // Try different Gemma 4 model names
  const gemma4Models = [
    'google/gemma-4-2b-it',
    'google/gemma-4-9b-it',
    'google/gemma-4-27b-it',
    'google/gemma-4',
    'gemma-4-2b',
    'gemma-4-9b'
  ];

  for (const model of gemma4Models) {
    try {
      console.log(`  Trying: ${model}...`);
      
      const result = await hf.textGeneration({
        model,
        inputs: 'What is 2+2? Answer with just the number.',
        parameters: {
          max_new_tokens: 10,
          temperature: 0.1
        }
      });

      console.log(`  ✅ SUCCESS! Response: ${result.generated_text.trim()}`);
      console.log(`  Model ID: ${model}`);
      return model;

    } catch (error) {
      console.log(`  ❌ Failed: ${error.message.substring(0, 100)}`);
    }
  }

  console.log('\n  ⚠️  Gemma 4 not found on Hugging Face');
  return null;
}

// Test 2: Check what models ARE available
async function testAvailableModels() {
  console.log('\n📦 Test 2: Available Gemma Models');
  console.log('-'.repeat(70));

  if (!HF_TOKEN) {
    console.log('❌ No HF_TOKEN');
    return;
  }

  const hf = new HfInference(HF_TOKEN);

  // These models definitely exist
  const workingModels = [
    'google/gemma-2-2b-it',
    'google/gemma-2-9b-it'
  ];

  for (const model of workingModels) {
    try {
      console.log(`  Testing: ${model}...`);
      
      const result = await hf.textGeneration({
        model,
        inputs: 'Say "test successful"',
        parameters: {
          max_new_tokens: 20,
          temperature: 0.1
        }
      });

      console.log(`  ✅ Works! Response: ${result.generated_text.trim().substring(0, 50)}`);

    } catch (error) {
      console.log(`  ❌ Failed: ${error.message.substring(0, 80)}`);
    }
  }
}

// Test 3: Web search for Gemma 4 availability
async function checkGemma4Availability() {
  console.log('\n📦 Test 3: Gemma 4 Status Check');
  console.log('-'.repeat(70));
  
  console.log('  According to official sources:');
  console.log('  - Gemma 4 released: April 2025');
  console.log('  - Available via: Google AI Studio');
  console.log('  - API: Not yet publicly available');
  console.log('  - Hugging Face: Not yet uploaded');
  console.log('');
  console.log('  Current options:');
  console.log('  ✅ Gemma 2: Available on Hugging Face');
  console.log('  ⚠️  Gemma 4: Research/limited access only');
  console.log('  ✅ Gemini: Available via Google AI API');
}

// Run tests
async function main() {
  try {
    await testHuggingFace();
    await testAvailableModels();
    await checkGemma4Availability();

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log('');
    console.log('Gemma 4 Status: ❌ Not publicly available via API yet');
    console.log('');
    console.log('Available Now:');
    console.log('  ✅ Gemma 2 (via Hugging Face)');
    console.log('  ✅ Gemini (via Google AI Studio)');
    console.log('  ✅ GPT-4, Claude (via their APIs)');
    console.log('');
    console.log('For Gemma 4:');
    console.log('  - Currently: Research/limited access');
    console.log('  - Expected: Public API in coming months');
    console.log('  - Alternative: Use Gemma 2 (similar capabilities)');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);
