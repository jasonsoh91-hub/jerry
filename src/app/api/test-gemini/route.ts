import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// List of common Gemini models to try
const MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite'
];

export async function POST(request: NextRequest) {
  const results: any[] = [];

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    console.log('🔑 Testing Gemini API with multiple models...');
    console.log('API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length);

    // Test each model
    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`Testing model: ${modelName}...`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = 'Say "OK" in JSON format like {"status": "OK"}';

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`✅ ${modelName} works! Response:`, text);

        results.push({
          model: modelName,
          status: 'success',
          response: text
        });

      } catch (error: any) {
        console.log(`❌ ${modelName} failed:`, error.message);

        results.push({
          model: modelName,
          status: 'failed',
          error: error.message
        });
      }
    }

    const workingModels = results.filter(r => r.status === 'success');

    return NextResponse.json({
      success: true,
      total: MODELS_TO_TRY.length,
      working: workingModels.length,
      results
    });

  } catch (error) {
    console.error('❌ Test failed:', error);

    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
