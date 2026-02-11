
import { GoogleGenAI, Type } from "@google/genai";
import { Priority } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const parseNaturalLanguageTask = async (input: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse this task input into structured data: "${input}". 
      Current Date: ${new Date().toISOString()}.
      
      Rules:
      - 'priority' should be 1 (urgent) to 4 (normal).
      - 'dueDate' should be in YYYY-MM-DD format if mentioned.
      - Default priority is 4.
      - 'content' is the main task title.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            description: { type: Type.STRING },
            dueDate: { type: Type.STRING, description: "ISO date string or YYYY-MM-DD" },
            priority: { type: Type.INTEGER, enum: [1, 2, 3, 4] },
          },
          required: ["content"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
};

export const getSmartProductivityTip = async (tasks: any[]) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on these tasks: ${JSON.stringify(tasks.slice(0, 10))}, give a one-sentence productivity tip or encouragement. Keep it under 20 words.`,
    });
    return response.text.trim();
  } catch (error) {
    return "Focus on your most important task today!";
  }
};
