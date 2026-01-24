"use client";

import { Database, HardDrive, Trash2 } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    if (!confirm("Вы уверены? Все данные будут удалены.")) {
      return;
    }

    setIsClearing(true);
    try {
      const { del } = await import("idb-keyval");
      await del("chgk-web-db");
      window.location.reload();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      {/* Storage info */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Хранилище данных</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <HardDrive className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-medium">Локальное хранилище</p>
              <p className="text-muted-foreground">
                Все данные хранятся локально в вашем браузере с использованием SQLite. Данные не
                передаются на сервер.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              type="button"
              onClick={handleClearData}
              disabled={isClearing}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? "Удаление..." : "Очистить все данные"}
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">О приложении</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>CHGK Web - приложение для работы с пакетами вопросов "Что? Где? Когда?".</p>
          <p>
            Позволяет импортировать пакеты из DOCX, редактировать вопросы и экспортировать в
            различные форматы.
          </p>
        </div>
      </div>
    </div>
  );
}
