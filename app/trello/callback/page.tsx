"use client";

import { useEffect, useState } from "react";

export default function TrelloCallbackPage() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Trello returns token in URL hash: #token=xxx
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");

    if (token) {
      // Send token to opener window
      if (window.opener) {
        window.opener.postMessage({ type: "trello_token", token }, window.location.origin);
        setStatus("success");
        // Close after short delay to show success message
        setTimeout(() => window.close(), 1500);
      } else {
        // No opener - just show error (token should be handled by opener)
        setStatus("error");
        setError("Окно должно быть открыто из приложения");
      }
    } else {
      setStatus("error");
      setError("Token not received from Trello");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p>Авторизация...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center mx-auto">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Успех"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p>Trello подключен</p>
            <p className="text-sm text-muted-foreground">Окно закроется автоматически</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center mx-auto">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Ошибка"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p>Ошибка авторизации</p>
            {error && <p className="text-sm text-muted-foreground">{error}</p>}
            <button
              type="button"
              onClick={() => window.close()}
              className="text-sm text-primary hover:underline"
            >
              Закрыть окно
            </button>
          </>
        )}
      </div>
    </div>
  );
}
