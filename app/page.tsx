"use client";

import { Show } from "@clerk/nextjs";
import { ArrowRight, ArrowUpRight, ExternalLink, Lock, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function LandingPage() {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-blue-600/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-600/10 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Header */}
      <header className="relative z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
              <span className="text-lg font-bold">?</span>
            </div>
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              CHGK Web Suite
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/sign-up"
                className="px-5 py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors inline-flex items-center gap-2"
              >
                Начать
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/packages"
                className="px-5 py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors inline-flex items-center gap-2"
              >
                Открыть
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Show>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative">
        <section className="pt-20 pb-32 md:pt-32 md:pb-40">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-4xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 mb-8 animate-fade-in">
                <Lock className="w-3.5 h-3.5" />
                <span>End-to-end шифрование</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[0.95] animate-fade-in animate-delay-100">
                Редактор
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
                  пакетов ЧГК
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-8 text-xl md:text-2xl text-white/50 max-w-xl leading-relaxed animate-fade-in animate-delay-200">
                Создавайте, редактируйте и экспортируйте пакеты вопросов. Все данные защищены.
              </p>

              {/* CTA */}
              <div className="mt-12 flex flex-wrap gap-4 animate-fade-in animate-delay-300">
                <Show when="signed-out">
                  <Link
                    href="/sign-up"
                    className="group px-8 py-4 text-base font-medium bg-white text-black rounded-xl hover:bg-white/90 transition-all inline-flex items-center gap-3"
                  >
                    Создать аккаунт
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/sign-in"
                    className="px-8 py-4 text-base font-medium text-white/70 hover:text-white border border-white/20 rounded-xl hover:border-white/40 transition-all"
                  >
                    Войти
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/packages"
                    className="group px-8 py-4 text-base font-medium bg-white text-black rounded-xl hover:bg-white/90 transition-all inline-flex items-center gap-3"
                  >
                    Перейти к пакетам
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Show>
              </div>
            </div>

            {/* Question card */}
            <div className="mt-20 md:mt-24 animate-fade-in animate-delay-400">
              <div className="relative max-w-2xl">
                {/* Glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-3xl blur-2xl opacity-50" />

                <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8">
                  <a
                    href="https://gotquestions.online/question/117351"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors"
                    title="Источник"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400 text-sm font-bold">1</span>
                    </div>
                    <span className="text-sm text-white/40 uppercase tracking-wider">Дуплет</span>
                  </div>
                  <div className="space-y-4 text-lg md:text-xl leading-relaxed text-white/90">
                    <p>
                      1. Афоризм гласит, что никогда не надо покупать питбуля у такого человека.
                      Ответьте одним словом: какого?
                    </p>
                    <p>
                      2. Прослушайте загадку: «Четыре ноги и одна рука». Ответьте на нее одним
                      словом.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnswers(!showAnswers)}
                    className="mt-6 pt-6 border-t border-white/10 w-full text-left flex flex-wrap items-center gap-3 group"
                  >
                    <span className="text-sm text-white/40">
                      {showAnswers ? "Ответы:" : "Показать ответы"}
                    </span>
                    {showAnswers ? (
                      <>
                        <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-medium">
                          Однорукого
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-medium">
                          Питбуль
                        </span>
                      </>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/30 text-sm font-medium group-hover:bg-white/10 group-hover:text-white/50 transition-colors">
                        Нажмите, чтобы раскрыть
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Zap,
                  title: "7 форматов экспорта",
                  desc: "DOCX, PPTX, Telegram, .4s, CHGK-DB, OpenQuiz, Reddit",
                },
                {
                  icon: Lock,
                  title: "E2E шифрование",
                  desc: "AES-256-GCM. Сервер не видит ваши данные.",
                },
                {
                  icon: Shield,
                  title: "Импорт отовсюду",
                  desc: "DOCX, TXT файлы и доски Trello",
                },
              ].map((feature, i) => (
                <div
                  key={feature.title}
                  className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all animate-fade-in"
                  style={{ animationDelay: `${500 + i * 100}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-white/50 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 animate-fade-in">
              Готовы начать?
            </h2>
            <p className="text-white/50 mb-10 animate-fade-in animate-delay-100">
              Бесплатная регистрация. Никаких ограничений.
            </p>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-3 px-8 py-4 text-base font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:opacity-90 transition-opacity animate-fade-in animate-delay-200"
              >
                Создать аккаунт
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/packages"
                className="group inline-flex items-center gap-3 px-8 py-4 text-base font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:opacity-90 transition-opacity animate-fade-in animate-delay-200"
              >
                Перейти к пакетам
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Show>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <span className="font-bold text-white/70">?</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white/70">CHGK Web Suite</span>
                <span className="text-white/30">|</span>
                <a
                  href="https://github.com/kopandante/chgk-web-suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  GitHub
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="text-white/40 text-center sm:text-right">
              Вдохновлено проектом{" "}
              <a
                href="https://github.com/peczony/chgksuite"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors"
              >
                chgksuite
              </a>{" "}
              Александра Печеного
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
