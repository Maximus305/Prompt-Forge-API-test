import { NextRequest, NextResponse } from 'next/server';

interface ImageData {
  image: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export async function POST(req: NextRequest) {
  let requestBody;
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { image } = requestBody as ImageData;

  if (!image) {
    return NextResponse.json({ error: 'Invalid input: image data is required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What's in this image?"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error! status: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    const description = data.choices[0].message.content;

    return NextResponse.json({
      message: 'Image analyzed successfully',
      analyzedImage: { image, description },
    });
  } catch (error) {
    console.error('Failed to analyze image:', error);
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
  }
}