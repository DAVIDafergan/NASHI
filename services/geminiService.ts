// src/services/geminiService.ts

/**
 * פונקציה לקבלת המלצה חכמה מהעוזרת
 * התיקון: הקריאה מתבצעת כעת לשרת ה-Backend שלנו ב-Railway 
 * כדי למנוע שגיאות CORS וחשיפה של מפתח ה-API בדפדפן.
 */
export const getSmartRecommendation = async (userQuery: string): Promise<string> => {
  try {
    const response = await fetch('https://nashi-production.up.railway.app/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ prompt: userQuery })
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    
    // החזרת הטקסט שהתקבל מגמיני דרך השרת
    return data.text || "מצטערת, לא הצלחתי לעבד את הבקשה כרגע.";
  } catch (error) {
    console.error("Gemini Error:", error);
    // הודעה ידידותית למשתמשת במקרה של שגיאה (נשמר מהקוד המקורי)
    return "חלה שגיאה בתקשורת עם העוזרת החכמה. נסי שוב בעוד כמה רגעים.";
  }
};