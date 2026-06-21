export interface PandaResponse<T> {
  reply: string;
  next_question: string | null;
  quickReplies: string[];
  current_step: string;
  draft_patch: Partial<T>;
  is_ready_to_preview: boolean;
}

export async function generatePandaStructuredResponse<T>({
  systemPrompt,
  userMessage,
  schema
}: {
  systemPrompt: string;
  userMessage: string;
  schema: any;
}): Promise<{ success: boolean; data?: PandaResponse<T>; error?: string; message?: string; status: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing');
    return { 
      success: false, 
      error: 'AI_NOT_CONFIGURED', 
      message: 'Panda is not ready yet. Please ask an admin to check the AI setup.',
      status: 503 
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
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

    let text = response.text;
    if (!text) {
      console.error('Empty response from Gemini');
      return { success: false, error: 'AI_EMPTY_RESPONSE', status: 500 };
    }

    // Safe JSON parser: strip markdown fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(text) as any;
      
      // Standardize quick_replies vs quickReplies
      const quickReplies = parsed.quickReplies || parsed.quick_replies || [];
      
      return { 
        success: true, 
        data: {
          reply: parsed.reply || "I didn't quite catch that.",
          next_question: parsed.next_question || null,
          quickReplies: quickReplies,
          current_step: parsed.current_step,
          draft_patch: parsed.draft_patch || {},
          is_ready_to_preview: !!parsed.is_ready_to_preview
        }, 
        status: 200 
      };
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', parseErr, text);
      return { success: false, error: 'AI_PARSE_ERROR', status: 500 };
    }
  } catch (err) {
    console.error('Gemini API Error:', err);
    return { success: false, error: 'AI_REQUEST_FAILED', status: 500 };
  }
}
