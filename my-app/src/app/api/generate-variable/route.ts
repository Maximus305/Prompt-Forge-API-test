import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { variableName, variableDescription, dataType, promptContext, instruction, otherVariables } = body;

  if (!variableName) {
    return NextResponse.json({ error: 'variableName is required' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates realistic sample values for prompt template variables. Return ONLY the value itself, no quotes, no explanation, no markdown. Keep it concise and realistic.',
          },
          {
            role: 'user',
            content: `Generate a value for this prompt variable:\n\nName: ${variableName}\nType: ${dataType || 'string'}${variableDescription ? `\nDescription: ${variableDescription}` : ''}${promptContext ? `\nContext: This is for a prompt called "${promptContext}"` : ''}${otherVariables?.length ? `\n\nOther variables already filled in:\n${otherVariables.map((v: { name: string; value: string }) => `- ${v.name}: ${v.value}`).join('\n')}` : ''}${instruction ? `\n\nUser instruction: ${instruction}` : ''}\n\nReturn only the value.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const value = data.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ value });
  } catch (error) {
    console.error('Generate variable error:', error);
    return NextResponse.json({ error: 'Failed to generate value' }, { status: 500 });
  }
}
