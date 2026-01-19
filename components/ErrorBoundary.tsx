import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // מעדכן את המצב כך שהרינדור הבא יציג את ממשק הגיבוי
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // כאן אפשר להחזיר הודעת שגיאה קטנה או כלום (null)
      return null; 
    }

    return this.children;
  }
}

export default ErrorBoundary;