import { GoogleGenAI, Type, Schema } from '@google/genai';

export interface PandaResponse<T> {
  reply: string;
  next_question: string | null;
  quick_replies: string[];
  current_step: string;
  draft_patch: Partial<T>;
  is_ready_to_preview: boolean;
}

export async function generateStructuredPandaResponse<T>(
  systemPrompt: string,
  userMessage: string,
  schema: Schema
): Promise<PandaResponse<T> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) {
      console.error('Empty response from Gemini');
      return null;
    }

    try {
      const parsed = JSON.parse(text) as PandaResponse<T>;
      return parsed;
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', parseErr, text);
      return null;
    }
  } catch (err) {
    console.error('Gemini API Error:', err);
    return null;
  }
}
