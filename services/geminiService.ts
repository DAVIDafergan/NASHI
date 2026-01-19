// src/services/geminiService.ts

export const getSmartRecommendation = async (userQuery: string): Promise<string> => {
  try {
    const response = await fetch('https://nashi-production.up.railway.app/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ prompt: userQuery })
    });

    // בדיקה אם התגובה חזרה בצורה תקינה מהשרת
    if (!response.ok) {
      console.warn(`Server responded with status: ${response.status}`);
      return "מצטערת, שירות ה-AI זמין כרגע רק חלקית. נסי שוב מאוחר יותר.";
    }

    const data = await response.json();
    
    // החזרת הטקסט או הודעת ברירת מחדל אם השדה ריק
    return data.text || "לא הצלחתי לגבש המלצה כרגע, האם תרצי לשאול משהו אחר?";

  } catch (error) {
    // השכבה הזו מבטיחה שהפונקציה תמיד תחזיר מחרוזת ולא תזרוק שגיאה שתפיל את האתר
    console.error("Gemini Service Error:", error);
    return "חלה שגיאה בתקשורת עם העוזרת החכמה. שאר האתר עובד כרגיל!";
  }
};