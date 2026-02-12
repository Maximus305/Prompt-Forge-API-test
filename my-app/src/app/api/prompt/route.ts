import { NextRequest, NextResponse } from 'next/server';

interface PromptRequest {
  apiUrl: string;
  apiKey: string;
  body: string;
}

export async function POST(req: NextRequest) {
  let payload: PromptRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { apiUrl, apiKey, body } = payload;

  if (!apiUrl || !apiKey || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Parse the body to validate it's valid JSON
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(parsedBody),
    });

    const duration = Date.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseText = await response.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return NextResponse.json({
      result: responseData,
      meta: {
        status: response.status,
        statusText: response.statusText,
        duration,
        responseHeaders,
        sentBody: parsedBody,
      },
    }, { status: response.ok ? 200 : response.status });
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to reach the API',
      meta: {
        status: 0,
        statusText: 'Network Error',
        duration,
        responseHeaders: {},
        sentBody: parsedBody,
      },
    }, { status: 502 });
  }
}
