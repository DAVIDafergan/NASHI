import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getSmartRecommendation = async (userQuery: string): Promise<string> => {
  if (!API_KEY) {
    return "אנא הגדירי מפתח API כדי להשתמש בעוזרת החכמה.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        את עוזרת וירטואלית באפליקציה עירונית לתרבות נשים בשם "נשי".
        המטרה שלך היא לעודד נשים להשתתף באירועי תרבות, להתנדב ולהעצים את עצמן.
        עני בעברית בלבד בצורה נעימה, מעצימה וקצרה.
        
        שאלה של המשתמשת: ${userQuery}
      `,
    });
    
    return response.text || "מצטערת, לא הצלחתי לעבד את הבקשה כרגע.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "חלה שגיאה בתקשורת עם העוזרת החכמה.";
  }
};
