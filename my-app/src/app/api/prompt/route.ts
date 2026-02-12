import { NextRequest, NextResponse } from 'next/server';

interface PromptRequest {
  apiUrl: string;
  apiKey: string;
  prompt: string;
}

export async function POST(req: NextRequest) {
  let body: PromptRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { apiUrl, apiKey, prompt } = body;

  if (!apiUrl || !apiKey || !prompt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: `API returned ${response.status}: ${JSON.stringify(errorData)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to reach the API' }, { status: 502 });
  }
}
