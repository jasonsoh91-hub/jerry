import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    console.log('🔍 Listing available models...');
    console.log('API Key present:', !!process.env.GEMINI_API_KEY);

    // List available models
    const models = await genAI.listModels();

    console.log('✅ Available models:', models.length);
    models.forEach(model => {
      console.log(`  - ${model.name} (${model.displayName})`);
    });

    return NextResponse.json({
      success: true,
      count: models.length,
      models: models.map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description
      }))
    });

  } catch (error) {
    console.error('❌ List models failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to list models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
