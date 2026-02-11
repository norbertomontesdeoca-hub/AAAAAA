
import { GoogleGenAI, Type } from "@google/genai";
import { Priority } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const parseNaturalLanguageTask = async (input: string, projects: { id: string, name: string }[]) => {
  try {
    const projectNames = projects.map(p => p.name).join(', ');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse this task: "${input}". 
      Context: Today is ${new Date().toLocaleDateString()}.
      Available Projects: ${projectNames}.
      
      Rules:
      - priority: 1 (urgent/red) to 4 (normal/grey).
      - dueDate: YYYY-MM-DD.
      - projectId: Match with available projects if mentioned, otherwise null.
      - content: Clear, concise title.
      - description: Any extra context.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            description: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            priority: { type: Type.INTEGER, enum: [1, 2, 3, 4] },
            projectName: { type: Type.STRING }
          },
          required: ["content"]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    // Match project name to ID
    if (parsed.projectName) {
      const match = projects.find(p => p.name.toLowerCase().includes(parsed.projectName.toLowerCase()));
      if (match) parsed.projectId = match.id;
    }
    return parsed;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
};

export const refineTaskDescription = async (taskContent: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Make this task more actionable and professional: "${taskContent}". Return only the refined title.`,
    });
    return response.text.trim();
  } catch {
    return taskContent;
  }
};

export const getSmartProductivityTip = async (tasks: any[]) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: User has ${tasks.length} pending tasks. Top task: "${tasks[0]?.content || 'None'}". 
      Give a short, punchy productivity advice (max 15 words) in Spanish.`,
    });
    return response.text.trim();
  } catch (error) {
    return "¡Tú puedes con todo hoy! Empieza por lo más pequeño.";
  }
};
