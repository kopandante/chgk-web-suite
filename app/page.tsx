"use client";

import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Import,
  Lock,
  MessageSquare,
  MonitorSmartphone,
  Shield,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    icon: Lock,
    title: "E2E шифрование",
    description: "Все данные шифруются в браузере до отправки на сервер. AES-256-GCM.",
  },
  {
    icon: Import,
    title: "Импорт из DOCX и Trello",
    description: "Загружайте пакеты из файлов или досок Trello одним кликом.",
  },
  {
    icon: FileText,
    title: "Экспорт в 7 форматов",
    description: "DOCX, PPTX, Telegram, .4s, CHGK-DB, OpenQuiz, Reddit.",
  },
  {
    icon: MessageSquare,
    title: "Публикация в Telegram",
    description: "Отправляйте вопросы в каналы со спойлерами и задержками.",
  },
  {
    icon: MonitorSmartphone,
    title: "Синхронизация",
    description: "Работайте с любого устройства в реальном времени.",
  },
  {
    icon: Shield,
    title: "Полная приватность",
    description: "Сервер не имеет доступа к вашим данным. Zero-knowledge.",
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
    <div className="min-h-screen bg-background paper-texture">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-semibold tracking-tight">
              CHGK Web Suite
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/sign-up"
                className="btn-primary rounded-lg px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                Начать работу
                <ArrowRight className="w-4 h-4" />
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/packages"
                className="btn-primary rounded-lg px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                Мои пакеты
                <ArrowRight className="w-4 h-4" />
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              <span>End-to-end шифрование</span>
            </div>

            {/* Main heading */}
            <h1 className="animate-fade-in-up animate-delay-100 text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
              Работа с пакетами <span className="text-gradient">вопросов ЧГК</span>
            </h1>

            {/* Subtitle */}
            <p className="animate-fade-in-up animate-delay-200 mt-6 text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Создавайте, редактируйте и экспортируйте пакеты вопросов. Ваши данные защищены
              сквозным шифрованием.
            </p>

            {/* CTA buttons */}
            <div className="animate-fade-in-up animate-delay-300 mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <SignedOut>
                <Link
                  href="/sign-up"
                  className="btn-gold rounded-lg px-8 py-4 text-base inline-flex items-center justify-center gap-2"
                >
                  Создать аккаунт
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/sign-in"
                  className="btn-outline rounded-lg px-8 py-4 text-base inline-flex items-center justify-center"
                >
                  Войти в систему
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/packages"
                  className="btn-gold rounded-lg px-8 py-4 text-base inline-flex items-center justify-center gap-2"
                >
                  Перейти к пакетам
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </SignedIn>
            </div>
          </div>

          {/* Decorative element */}
          <div className="animate-fade-in-up animate-delay-400 mt-16 max-w-3xl mx-auto">
            <div className="relative rounded-2xl border bg-card/50 p-8 backdrop-blur-sm">
              <div className="absolute -top-3 left-8 px-3 py-1 rounded-md bg-accent text-accent-foreground text-xs font-medium small-caps">
                Пример вопроса
              </div>
              <div className="space-y-4">
                <p className="text-lg leading-relaxed">
                  В 1920-х годах жители одного американского города регулярно наблюдали, как некий
                  человек ходит по улицам в костюме и котелке, неся под мышкой свернутый зонт.
                  Назовите этого человека.
                </p>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Ответ:</span>{" "}
                    <span className="bg-muted px-2 py-0.5 rounded">Чарли Чаплин</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              Все инструменты в одном месте
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              От импорта до публикации — полный цикл работы с вопросами
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card-elevated p-6 animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About encryption */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Shield className="w-4 h-4" />
                  Zero-knowledge
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Про шифрование</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Все ваши данные (пакеты, вопросы, изображения) шифруются в браузере с
                    использованием <strong className="text-foreground">AES-256-GCM</strong> до
                    отправки на сервер.
                  </p>
                  <p>
                    Сервер хранит только зашифрованные данные и не имеет ключа для их расшифровки.
                    Ключ шифрования хранится в вашем аккаунте и автоматически синхронизируется между
                    устройствами.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl" />
                <div className="relative rounded-2xl border bg-card p-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Шифрование</div>
                        <div className="text-sm text-muted-foreground">AES-256-GCM</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Обмен ключами</div>
                        <div className="text-sm text-muted-foreground">ECDH P-256</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">Хранение</div>
                        <div className="text-sm text-muted-foreground">Zero-knowledge</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Готовы начать?</h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto mb-10">
            Создайте аккаунт и начните работать с пакетами вопросов уже сегодня. Регистрация
            бесплатна.
          </p>
          <SignedOut>
            <Link
              href="/sign-up"
              className="btn-gold rounded-lg px-8 py-4 text-base inline-flex items-center gap-2"
            >
              Создать аккаунт
              <ArrowRight className="w-5 h-5" />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/packages"
              className="btn-gold rounded-lg px-8 py-4 text-base inline-flex items-center gap-2"
            >
              Перейти к пакетам
              <ArrowRight className="w-5 h-5" />
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-card/50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold">CHGK Web Suite</span>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">
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
              <p className="mt-1">
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
          </div>
        </div>
      </footer>
    </div>
  );
}
