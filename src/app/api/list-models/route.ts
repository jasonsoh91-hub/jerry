import { NextRequest, NextResponse } from 'next/server';

// Known Gemini models available in the API
const GEMINI_MODELS = [
  {
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Fast and efficient model for quick responses'
  },
  {
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Fast and lightweight model'
  },
  {
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Advanced model for complex tasks'
  }
];

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Listing available models...');
    console.log('API Key present:', !!process.env.GEMINI_API_KEY);

    return NextResponse.json({
      success: true,
      count: GEMINI_MODELS.length,
      models: GEMINI_MODELS
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
