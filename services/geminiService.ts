import { GoogleGenerativeAI } from "@google/generative-ai";

// משיכת המפתח מה-Variables של Railway
const API_KEY = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || '';

// אתחול הספרייה של גוגל
const genAI = new GoogleGenerativeAI(API_KEY);

export const getSmartRecommendation = async (userQuery: string): Promise<string> => {
  if (!API_KEY) {
    return "אנא הגדירי מפתח API (GEMINI_API_KEY) בשרת כדי להשתמש בעוזרת החכמה.";
  }

  try {
    // שימוש במודל 1.5-flash המהיר והחסכוני ביותר למשימות מסוג זה
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash' 
    });

    // מכיוון שאנחנו שולחים את ההקשר (Context) מה-Component, כאן אנחנו רק מעבירים אותו
    const result = await model.generateContent(userQuery);
    const response = await result.response;
    const text = response.text();
    
    return text || "מצטערת, לא הצלחתי לעבד את הבקשה כרגע.";
  } catch (error) {
    console.error("Gemini Error:", error);
    // הודעה ידידותית למשתמשת במקרה של שגיאה
    return "חלה שגיאה בתקשורת עם העוזרת החכמה. נסי שוב בעוד כמה רגעים.";
  }
};