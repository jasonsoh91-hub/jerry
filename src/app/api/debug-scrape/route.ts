import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Test scraping the URL
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let html = '';
    let success = false;

    for (const proxyUrl of proxies) {
      try {
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          html = await response.text();
          success = true;
          break;
        }
      } catch (proxyError) {
        continue;
      }
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 });
    }

    // Extract text content from HTML
    let text = html
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gs, '')
      .replace(/<footer[^>]*>.*?<\/footer>/gs, '')
      .replace(/<header[^>]*>.*?<\/header>/gs, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Look for spec keywords
    const specKeywords = [
      'specification', 'specs', 'technical', 'features',
      'resolution', 'refresh rate', 'response time', 'hertz',
      'display', 'panel', 'screen', 'warranty', 'ports', 'connectivity'
    ];

    let relevantText = '';
    for (const keyword of specKeywords) {
      const keywordIndex = text.toLowerCase().indexOf(keyword);
      if (keywordIndex !== -1) {
        const start = Math.max(0, keywordIndex - 50);
        const end = Math.min(text.length, keywordIndex + 300);
        relevantText += text.substring(start, end) + '...\n\n';
      }
    }

    return NextResponse.json({
      success: true,
      url: url,
      htmlLength: html.length,
      textLength: text.length,
      relevantText: relevantText || 'No spec sections found',
      fullTextSample: text.substring(0, 2000) + '...'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug scrape failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
