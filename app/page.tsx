"use client";

import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { FileText, Import, Lock, MessageSquare, MonitorSmartphone, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    icon: Lock,
    title: "E2E шифрование",
    description: "Все данные шифруются в браузере до отправки на сервер",
  },
  {
    icon: Import,
    title: "Импорт из DOCX и Trello",
    description: "Загружайте пакеты из файлов или досок Trello",
  },
  {
    icon: FileText,
    title: "Экспорт в 6 форматов",
    description: "DOCX, PPTX, Telegram, CHGK-DB, OpenQuiz, Reddit",
  },
  {
    icon: MessageSquare,
    title: "Публикация в Telegram",
    description: "Отправляйте вопросы в каналы со спойлерами",
  },
  {
    icon: MonitorSmartphone,
    title: "Синхронизация",
    description: "Работайте с любого устройства в реальном времени",
  },
  {
    icon: Shield,
    title: "Приватность",
    description: "Сервер не имеет доступа к вашим данным",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/packages");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold">CHGK Web Suite</span>
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Войти
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/packages"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Мои пакеты
            </Link>
          </SignedIn>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Работа с пакетами ЧГК</h1>
          <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
            Создавайте, редактируйте и экспортируйте пакеты вопросов с end-to-end шифрованием данных
          </p>
          <div className="mt-10 flex gap-4 justify-center">
            <SignedOut>
              <Link
                href="/sign-up"
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Создать аккаунт
              </Link>
              <Link
                href="/sign-in"
                className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                Войти
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/packages"
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Перейти к пакетам
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Возможности</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-lg border bg-card p-6">
                <feature.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About encryption */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Про шифрование</h2>
          <div className="prose prose-neutral dark:prose-invert mx-auto">
            <p className="text-muted-foreground">
              Все ваши данные (пакеты, вопросы, изображения) шифруются в браузере с использованием{" "}
              <strong>AES-256-GCM</strong> до отправки на сервер. Сервер хранит только зашифрованные
              данные и не имеет ключа для их расшифровки.
            </p>
            <p className="text-muted-foreground">
              Ключ шифрования хранится в вашем аккаунте и автоматически синхронизируется между
              устройствами. Вам не нужно вводить отдельный пароль для шифрования.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Проект вдохновлен работой Александра Печеного и{" "}
            <a
              href="https://github.com/peczony/chgksuite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              chgksuite
            </a>
          </p>
          <p className="mt-2">
            <a
              href="https://github.com/kopandante/chgk-web-suite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            {" | "}
            MIT License
          </p>
        </div>
      </footer>
    </div>
  );
}
