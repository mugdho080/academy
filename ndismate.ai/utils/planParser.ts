import { GoogleGenAI, Type } from "@google/genai";
import { NDISPlan, BudgetCategory } from "../types";

export async function parsePlanWithGemini(filePart: any): Promise<Partial<NDISPlan>> {
  // Obtain API key exclusively from environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        filePart,
        { text: `
          Analyze this NDIS plan PDF document carefully. Extract the following details into a JSON structure:
          - Participant Name
          - NDIS Number
          - Plan Start Date (YYYY-MM-DD)
          - Plan End Date (YYYY-MM-DD)
          - Goals: Extract text and classify as Short-term, Medium-term, or Long-term.
          - Budgets: Extract each budget line item from tables. 
            - Map category to exactly one of: 'Core', 'Capacity Building', 'Capital'.
            - If "Spent" amount is not explicitly listed, set it to 0.
            - Calculate remaining as (allocated - spent).
            - Generate a short description based on the support item name.
            - Generate a unique ID (b1, b2, etc.).
          ` 
        }
      ]
    },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                participantName: { type: Type.STRING },
                ndisNumber: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                goals: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            text: { type: Type.STRING },
                            type: { type: Type.STRING }
                        }
                    }
                },
                budgets: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            category: { type: Type.STRING },
                            name: { type: Type.STRING },
                            allocated: { type: Type.NUMBER },
                            spent: { type: Type.NUMBER },
                            remaining: { type: Type.NUMBER },
                            description: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No data returned from AI");
  
  return JSON.parse(text);
}