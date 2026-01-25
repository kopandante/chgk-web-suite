"use client";

import {
  Copy,
  Database,
  HardDrive,
  Link2,
  Loader2,
  Send,
  Trash2,
  Trello,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTelegramChannels } from "@/hooks/use-telegram-channel";
import { testBotConnection } from "@/lib/export/telegram";
import {
  clearTrelloToken,
  getTrelloToken,
  openTrelloAuth,
  testTrelloConnection,
} from "@/lib/trello/client";

export default function SettingsPage() {
  const [isClearing, setIsClearing] = useState(false);

  // Trello state
  const [trelloConnected, setTrelloConnected] = useState(false);
  const [trelloLoading, setTrelloLoading] = useState(true);

  // Telegram state
  const {
    isLoading: telegramLoading,
    isAuthenticated,
    channels,
    linkStatus,
    startLinking,
    unlinkChannel,
    cancelLinking,
  } = useTelegramChannels();

  const [pendingCode, setPendingCode] = useState<{
    code: string;
    expiresAt: number;
  } | null>(null);
  const [botName, setBotName] = useState<string | null>(null);

  // Check Trello connection on mount
  useEffect(() => {
    const checkTrello = async () => {
      const token = getTrelloToken();
      if (token) {
        const result = await testTrelloConnection();
        setTrelloConnected(result.ok);
      }
      setTrelloLoading(false);
    };
    checkTrello();
  }, []);

  // Test bot connection on mount
  useEffect(() => {
    testBotConnection().then((result) => {
      if (result.ok && result.botName) {
        setBotName(result.botName);
      }
    });
  }, []);

  // Clear pending code when channel verified
  useEffect(() => {
    if (linkStatus?.status === "verified") {
      toast.success(`Канал "${linkStatus.channelTitle || linkStatus.channelId}" привязан`);
      setPendingCode(null);
    }
  }, [linkStatus?.status, linkStatus?.channelId, linkStatus?.channelTitle]);

  const displayLinkStatus =
    linkStatus?.status === "pending"
      ? linkStatus
      : pendingCode
        ? { status: "pending" as const, ...pendingCode }
        : linkStatus;

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

  const handleTrelloConnect = async () => {
    try {
      await openTrelloAuth();
      const result = await testTrelloConnection();
      setTrelloConnected(result.ok);
      if (result.ok) {
        toast.success("Trello подключен");
      }
    } catch {
      toast.error("Не удалось подключить Trello");
    }
  };

  const handleTrelloDisconnect = () => {
    clearTrelloToken();
    setTrelloConnected(false);
    toast.success("Trello отключен");
  };

  const handleStartLinking = async () => {
    try {
      const result = await startLinking();
      setPendingCode({ code: result.code, expiresAt: result.expiresAt });
    } catch {
      toast.error("Не удалось начать привязку канала");
    }
  };

  const handleUnlinkChannel = async (channelId: string) => {
    try {
      await unlinkChannel(channelId);
      toast.success("Канал отвязан");
    } catch {
      toast.error("Не удалось отвязать канал");
    }
  };

  const handleCancelLinking = async () => {
    try {
      await cancelLinking();
      setPendingCode(null);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      {/* Telegram Integration */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Telegram</h2>
        </div>

        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground">
            Войдите в аккаунт для привязки Telegram-каналов.
          </p>
        ) : telegramLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        ) : (
          <div className="space-y-4">
            {/* List of linked channels */}
            {channels.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Привязанные каналы</p>
                {channels.map((channel) => (
                  <div
                    key={channel.channelId}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{channel.channelTitle || channel.channelId}</span>
                    <button
                      type="button"
                      onClick={() => handleUnlinkChannel(channel.channelId)}
                      className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                      title="Отвязать канал"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Linking in progress */}
            {displayLinkStatus?.status === "pending" ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                  <div className="text-sm text-muted-foreground">
                    1. Добавьте бота {botName && <span className="font-medium">@{botName}</span>} в
                    канал как администратора
                  </div>
                  <div className="text-sm text-muted-foreground">
                    2. Отправьте этот код в канал:
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-background px-4 py-3 text-center text-2xl font-mono font-bold tracking-wider">
                      {displayLinkStatus.code}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(displayLinkStatus.code);
                        toast.success("Код скопирован");
                      }}
                      className="rounded-md border px-3 py-3 hover:bg-accent"
                      title="Скопировать"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ожидание сообщения в канале...
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelLinking}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleStartLinking}
                  className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  <Link2 className="h-4 w-4" />
                  {channels.length > 0 ? "Добавить канал" : "Привязать канал"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trello Integration */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Trello className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Trello</h2>
        </div>

        {trelloLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        ) : trelloConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Trello подключен. Вы можете импортировать доски при создании нового пакета.
            </p>
            <button
              type="button"
              onClick={handleTrelloDisconnect}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Unlink className="h-4 w-4" />
              Отключить Trello
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Подключите Trello для импорта досок с вопросами.
            </p>
            <button
              type="button"
              onClick={handleTrelloConnect}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              <Link2 className="h-4 w-4" />
              Подключить Trello
            </button>
          </div>
        )}
      </div>

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
