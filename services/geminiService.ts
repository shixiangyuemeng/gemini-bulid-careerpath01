
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { InternshipExperience, Resume } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const chatWithAI = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: `你是一个极其专业的简历顾问和深度访谈专家，名为“职引”。
你的核心任务是协助用户挖掘并提炼高质量的实习或工作经历。

行为准则：
1. **深度追问**：当用户分享一段经历时，不要立即生成卡片。先分析其内容是否包含：公司名称、职位、起止时间、具体职责、可量化的成就。
2. **结构化引导**：如果信息不全，请以温和且专业的方式一次性追问1-2个关键缺失点（例如：“听起来很棒！在字节跳动期间，你具体负责哪个产品模块？有没有什么量化的产出，比如提升了多少转化率？”）。
3. **STAR法则**：引导用户按照“情境(Situation)、任务(Task)、行动(Action)、结果(Result)”来描述工作内容。
4. **生成信号**：当你认为信息已经足够丰富（通常需要至少公司、职位、时间和3条以上的高质量描述）时，在回复的最后加上一行特殊标记 [READY_TO_STRUCTURE] ，并告诉用户你准备好为他整理卡片了。
5. **简洁有力**：回复要亲切，但不要冗长。`,
    }
  });

  return response.text;
};

export const structureExperience = async (text: string): Promise<InternshipExperience | null> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: `根据以下对话或描述，提炼并翻译为专业的简历语言（使用动词开头，强调产出和结果），输出结构化的JSON：\n\n${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            company: { type: Type.STRING, description: "实习公司或项目名称" },
            position: { type: Type.STRING, description: "职位名称" },
            duration: { type: Type.STRING, description: "实习时长/时间段" },
            description: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "使用专业简历用语描述的3-5条工作细节" 
            },
            category: { type: Type.STRING, enum: ["实习", "工作", "项目", "校园"] }
          },
          required: ["company", "position", "duration", "description", "category"],
        },
      },
    });

    if (!response.text) return null;
    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error structuring experience:", error);
    return null;
  }
};

export const translateResumeContent = async (resume: Resume, targetLang: string): Promise<Resume | null> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: `将以下简历内容翻译成${targetLang === 'EN' ? '英文' : '中文'}。请保持原有的JSON结构不变：\n\n${JSON.stringify(resume)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            status: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  experiences: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        company: { type: Type.STRING },
                        position: { type: Type.STRING },
                        duration: { type: Type.STRING },
                        description: { 
                          type: Type.ARRAY, 
                          items: { type: Type.STRING }
                        },
                        category: { type: Type.STRING },
                        status: { type: Type.STRING },
                      },
                      required: ["company", "position", "duration", "description"]
                    }
                  }
                },
                required: ["title", "experiences"]
              }
            }
          },
          required: ["id", "title", "date", "status", "sections"]
        },
      },
    });

    if (!response.text) return null;
    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error translating resume:", error);
    return null;
  }
};
