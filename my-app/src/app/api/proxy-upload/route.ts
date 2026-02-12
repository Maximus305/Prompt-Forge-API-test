import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type. Expected multipart/form-data.' }, { status: 400 });
  }

  try {
    const body = await req.arrayBuffer();
    const buffer = Buffer.from(body);

    const response = await axios.post(
      'https://pdf2llm-d4y3d99yh-maximus305s-projects.vercel.app/api/upload',
      buffer,
      {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'An error occurred while proxying the request.' }, { status: 500 });
  }
}