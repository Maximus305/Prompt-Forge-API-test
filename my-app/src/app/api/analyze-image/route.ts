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
  console.log('POST request received at /api/analyze-image');

  let requestBody;
  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully');
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  console.log('Request body:', requestBody);

  const { image } = requestBody as ImageData;

  if (!image) {
    console.log('No image data found in request body');
    return NextResponse.json({ error: 'Invalid input: image data is required' }, { status: 400 });
  }

  console.log('Image data found, length:', image.length);

  try {
    console.log('Preparing to send request to OpenAI API');
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

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error! status: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    console.log('OpenAI API response parsed successfully');

    const description = data.choices[0].message.content;
    console.log('Image description:', description);

    return NextResponse.json({
      message: 'Image analyzed successfully',
      analyzedImage: { image, description },
    });
  } catch (error) {
    console.error('Error in try block:', error);
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
  }
}

// Log when the module is loaded
console.log('Analyze image route module loaded');