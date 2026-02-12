import { NextRequest, NextResponse } from 'next/server';

interface ProxyRequest {
  targetUrl: string;
  apiKey: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
}

export async function POST(req: NextRequest) {
  let payload: ProxyRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { targetUrl, apiKey, method, body } = payload;

  if (!targetUrl || !apiKey || !method) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const startTime = Date.now();

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    fetchOptions.body = body;
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
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
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to reach the API',
      meta: {
        status: 0,
        statusText: 'Network Error',
        duration,
        responseHeaders: {},
      },
    }, { status: 502 });
  }
}
