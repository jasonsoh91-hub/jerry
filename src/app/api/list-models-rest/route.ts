import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }

    console.log('🔍 Listing models using REST API...');
    console.log('API Key:', apiKey.substring(0, 10) + '...');

    // Use REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ REST API error:', response.status, errorText);
      throw new Error(`REST API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Models retrieved:', data.models?.length || 0);

    const models = data.models || [];
    models.forEach((model: any) => {
      console.log(`  - ${model.name} (${model.displayName})`);
    });

    return NextResponse.json({
      success: true,
      count: models.length,
      models: models.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        supportedMethods: m.supportedMethods
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
