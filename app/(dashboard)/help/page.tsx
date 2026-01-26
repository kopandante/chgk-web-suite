"use client";

import {
  ChevronDown,
  Download,
  FileText,
  HelpCircle,
  Import,
  Lock,
  MessageSquare,
  Send,
  Shield,
  Trello,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
  icon?: React.ReactNode;
}

interface FaqSectionData {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: FaqItem[];
}

const faqSections: FaqSectionData[] = [
  {
    id: "start",
    title: "Начало работы",
    icon: <HelpCircle className="h-5 w-5" />,
    items: [
      {
        question: "Что такое CHGK Web Suite?",
        answer:
          "CHGK Web Suite — это веб-приложение для работы с пакетами вопросов «Что? Где? Когда?». Вы можете импортировать пакеты из DOCX файлов, редактировать вопросы, добавлять изображения и экспортировать в различные форматы.",
      },
      {
        question: "Как создать новый пакет?",
        answer:
          "Нажмите кнопку «Новый пакет» на главной странице. Вы можете создать пустой пакет, импортировать из DOCX файла или загрузить из Trello доски.",
      },
      {
        question: "Какие форматы файлов поддерживаются для импорта?",
        answer:
          "Для импорта поддерживаются файлы DOCX (Microsoft Word). Парсер автоматически распознает структуру вопросов, включая номера, ответы, зачёты, комментарии, источники и авторов.",
      },
    ],
  },
  {
    id: "security",
    title: "Шифрование и безопасность",
    icon: <Shield className="h-5 w-5" />,
    items: [
      {
        question: "Как работает шифрование?",
        answer:
          "Все ваши данные шифруются прямо в браузере с использованием алгоритма AES-256-GCM. Сервер хранит только зашифрованные данные и не имеет доступа к их содержимому. Ключ шифрования хранится в вашем аккаунте и автоматически загружается при входе.",
        icon: <Lock className="h-4 w-4" />,
      },
      {
        question: "Нужно ли мне запоминать пароль для шифрования?",
        answer:
          "Нет. Ключ шифрования создаётся автоматически при первом входе и привязывается к вашему аккаунту. Вам достаточно помнить только логин/пароль от аккаунта. При входе на любом устройстве данные расшифровываются автоматически.",
      },
      {
        question: "Могу ли я использовать разные устройства?",
        answer:
          "Да, вы можете работать с одним аккаунтом на разных устройствах и браузерах. При входе ключ шифрования загружается из вашего профиля и данные становятся доступны автоматически.",
      },
      {
        question: "Кто имеет доступ к моим данным?",
        answer:
          "На сервере хранятся только зашифрованные данные — без ключа они нечитаемы. Ключ хранится отдельно в вашем профиле. Разработчики приложения не имеют доступа к расшифрованным данным, так как не имеют доступа к вашему ключу.",
      },
    ],
  },
  {
    id: "questions",
    title: "Работа с вопросами",
    icon: <FileText className="h-5 w-5" />,
    items: [
      {
        question: "Какие поля есть у вопроса?",
        answer:
          "Каждый вопрос может содержать: номер, текст вопроса, ответ, зачётные ответы, незачётные ответы, комментарий, источник, автор и раздатку. Обязательным является только текст вопроса.",
      },
      {
        question: "Как добавить изображение к вопросу?",
        answer:
          "В редакторе вопроса нажмите кнопку добавления изображения или вставьте изображение из буфера обмена. Изображения также шифруются и хранятся безопасно.",
      },
      {
        question: "Что такое туры?",
        answer:
          "Тур — это раздел пакета, обычно содержащий 12–15 вопросов. Вы можете организовать вопросы по турам или оставить их в общем списке пакета.",
      },
      {
        question: "Как форматировать текст?",
        answer:
          "Используйте разметку: _курсив_, __жирный__, ___подчёркнутый___, ~зачёркнутый~. Форматирование сохраняется при экспорте в DOCX и PPTX.",
      },
    ],
  },
  {
    id: "import",
    title: "Импорт данных",
    icon: <Import className="h-5 w-5" />,
    items: [
      {
        question: "Как импортировать из DOCX?",
        answer:
          "При создании пакета выберите «Импорт из DOCX» и загрузите файл. Парсер распознает структуру автоматически. Поддерживаются маркеры: Вопрос, Ответ, Зачёт, Незачёт, Комментарий, Источник, Автор, Раздатка.",
      },
      {
        question: "Как импортировать из Trello?",
        answer:
          "Подключите Trello в настройках, затем при создании пакета выберите «Импорт из Trello». Выберите доску и список. Каждая карточка станет вопросом, описание карточки будет распарсено на поля.",
        icon: <Trello className="h-4 w-4" />,
      },
      {
        question: "Формат карточек Trello",
        answer:
          "Название карточки — текст вопроса. В описании можно указать поля: «Ответ: ...», «Зачёт: ...», «Комментарий: ...» и т.д. Или просто две строки: вопрос и ответ.",
      },
    ],
  },
  {
    id: "export",
    title: "Экспорт данных",
    icon: <Download className="h-5 w-5" />,
    items: [
      {
        question: "В какие форматы можно экспортировать?",
        answer:
          "Поддерживаются: DOCX (Word), PPTX (PowerPoint), CHGK-DB (для приложения CHGK Suite), OpenQuiz (XML), Reddit (Markdown), Telegram (для публикации в канале).",
      },
      {
        question: "Что такое режимы спойлеров в DOCX?",
        answer:
          "Режимы скрытия ответов: «Нет» — ответы видны сразу, «Белый текст» — ответы белым цветом (выделить для просмотра), «Новая страница» — ответы на отдельной странице, «Точки» — ответы заменены точками.",
      },
      {
        question: "Можно ли перемешать вопросы?",
        answer:
          "Да, при экспорте можно включить перемешивание. Если указать seed (число), порядок будет одинаковым при каждом экспорте с этим seed — полезно для воспроизводимости.",
      },
    ],
  },
  {
    id: "telegram",
    title: "Telegram интеграция",
    icon: <Send className="h-5 w-5" />,
    items: [
      {
        question: "Как привязать Telegram-канал?",
        answer:
          "1. Откройте Настройки и нажмите «Привязать канал»\n2. Добавьте бота в ваш канал как администратора\n3. Отправьте в канал код, показанный в приложении\n4. Канал будет привязан автоматически",
      },
      {
        question: "Как публиковать вопросы в Telegram?",
        answer:
          "Откройте пакет, нажмите «Экспорт», выберите формат «Telegram». Выберите привязанный канал и настройте параметры публикации (задержка между постами, формат и т.д.).",
      },
      {
        question: "Можно ли привязать несколько каналов?",
        answer:
          "Да, вы можете привязать неограниченное количество каналов. Каждый канал привязывается отдельно через процедуру верификации.",
      },
    ],
  },
];

function FaqSection({
  section,
  openIndex,
  onToggle,
}: {
  section: FaqSectionData;
  openIndex: number | null;
  onToggle: (index: number | null) => void;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div id={section.id} ref={sectionRef} className="rounded-lg border scroll-mt-4">
      <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
        {section.icon}
        <h2 className="font-semibold">{section.title}</h2>
      </div>
      <div className="divide-y">
        {section.items.map((item, index) => {
          const itemId = `${section.id}-${index + 1}`;
          return (
            <div
              key={index}
              id={itemId}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className="scroll-mt-4"
            >
              <button
                type="button"
                onClick={() => {
                  const newIndex = openIndex === index ? null : index;
                  onToggle(newIndex);
                  // Update URL hash
                  const hash = newIndex !== null ? `#${itemId}` : `#${section.id}`;
                  window.history.replaceState(null, "", hash);
                }}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
                  <span className="font-medium">{item.question}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-line">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [openStates, setOpenStates] = useState<Record<string, number | null>>({});
  const initialScrollDone = useRef(false);

  // Handle hash navigation on mount and hash change
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      // Parse hash: "section" or "section-N"
      const match = hash.match(/^([a-z]+)(?:-(\d+))?$/);
      if (!match) return;

      const [, sectionId, questionNum] = match;
      const section = faqSections.find((s) => s.id === sectionId);
      if (!section) return;

      // Open specific question if specified
      if (questionNum) {
        const qIndex = parseInt(questionNum, 10) - 1; // Convert to 0-based
        if (qIndex >= 0 && qIndex < section.items.length) {
          setOpenStates((prev) => ({ ...prev, [sectionId]: qIndex }));
        }
      }

      // Scroll to element after a short delay to ensure render
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: initialScrollDone.current ? "smooth" : "auto" });
        }
        initialScrollDone.current = true;
      }, 100);
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Справка</h1>
        <p className="text-muted-foreground">Ответы на частые вопросы о работе с приложением</p>
      </div>

      {/* Quick tips */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          Быстрые подсказки
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
          <li>Нажмите на пакет, чтобы открыть его для просмотра</li>
          <li>Данные автоматически шифруются и защищены вашим аккаунтом</li>
          <li>Импортируйте DOCX файлы с автоматическим распознаванием структуры</li>
          <li>Экспортируйте в разные форматы для игры или публикации</li>
        </ul>
      </div>

      {/* Security info */}
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
          <Shield className="h-4 w-4" />О безопасности данных
        </div>
        <p className="text-sm text-muted-foreground">
          Ваши данные защищены сквозным шифрованием. Ключ шифрования привязан к вашему аккаунту и
          загружается автоматически при входе. Сервер хранит только зашифрованные данные.
        </p>
      </div>

      {/* FAQ sections */}
      <div className="space-y-4">
        {faqSections.map((section) => (
          <FaqSection
            key={section.id}
            section={section}
            openIndex={openStates[section.id] ?? null}
            onToggle={(index) => setOpenStates((prev) => ({ ...prev, [section.id]: index }))}
          />
        ))}
      </div>

      {/* Contact */}
      <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
        Не нашли ответ? Напишите нам в Telegram:{" "}
        <a
          href="https://t.me/chgksuite"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          @chgksuite
        </a>
      </div>
    </div>
  );
}
