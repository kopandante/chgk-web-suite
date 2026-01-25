# CHGK Web Suite: Полная документация

## Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Технологический стек](#технологический-стек)
3. [Архитектура](#архитектура)
4. [Структура проекта](#структура-проекта)
5. [E2E шифрование](#e2e-шифрование)
6. [База данных (Convex)](#база-данных-convex)
7. [Парсер вопросов](#парсер-вопросов)
8. [Экспорт данных](#экспорт-данных)
9. [Интеграции](#интеграции)
10. [Компоненты UI](#компоненты-ui)
11. [Хуки и состояние](#хуки-и-состояние)
12. [API и маршруты](#api-и-маршруты)
13. [Разработка](#разработка)
14. [Безопасность](#безопасность)

---

## Обзор проекта

**CHGK Web Suite** - веб-приложение для работы с пакетами вопросов "Что? Где? Когда?" с полным E2E шифрованием данных.

### Ключевые возможности

- Импорт пакетов из DOCX файлов и Trello досок
- Редактирование вопросов с поддержкой изображений
- Экспорт в 6 форматов (DOCX, PPTX, CHGK-DB, OpenQuiz, Reddit, Telegram)
- End-to-end шифрование всех данных
- Публикация в Telegram-каналы
- Синхронизация между устройствами

### Принципы

- **Privacy-first**: все данные шифруются на клиенте до отправки на сервер
- **Offline-ready**: парсинг и экспорт работают полностью в браузере
- **Real-time**: мгновенная синхронизация через Convex

---

## Технологический стек

| Категория | Технология | Версия |
|-----------|------------|--------|
| Runtime | Bun | latest |
| Framework | Next.js (App Router) | 16 |
| Backend | Convex | latest |
| Авторизация | Clerk | latest |
| UI | shadcn/ui + Tailwind CSS | v4 |
| State | Zustand | latest |
| Data fetching | TanStack React Query | latest |
| Crypto | Web Crypto API | native |
| DOCX parsing | mammoth.js + jszip | - |
| DOCX export | docx | - |
| PPTX export | pptxgenjs | - |
| Linter | Biome | latest |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         Браузер                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  React UI   │  │   Zustand   │  │    Web Crypto API       │  │
│  │  (Next.js)  │  │   Store     │  │     (AES-256-GCM)       │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │   Encrypted Client    │                          │
│              │  (encrypt/decrypt)    │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │ (зашифрованные данные)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Convex                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  packages  │  tours  │  questions  │  images  │ telegram │    │
│  │  (encrypted base64 blobs)                                │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         Clerk                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  unsafeMetadata: { encryptionKey: "base64..." }          │    │
│  │  (экспортированный AES-256 ключ)                         │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Поток данных

1. **Аутентификация**: Clerk выдает JWT токен
2. **Инициализация ключа**: автоматически загружается или создается
3. **Операции**: данные шифруются на клиенте перед отправкой в Convex
4. **Синхронизация**: Convex обеспечивает real-time обновления между устройствами

---

## Структура проекта

```
chgk-web/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Защищенные страницы
│   │   ├── layout.tsx            # Layout с сайдбаром
│   │   ├── page.tsx              # Список пакетов
│   │   ├── new/page.tsx          # Создание пакета
│   │   ├── settings/page.tsx     # Настройки
│   │   └── [id]/                 # Динамические страницы пакета
│   │       ├── page.tsx          # Просмотр пакета
│   │       ├── edit/page.tsx     # Редактор
│   │       └── export/page.tsx   # Экспорт
│   ├── sign-in/                  # Страница входа (Clerk)
│   ├── sign-up/                  # Регистрация (Clerk)
│   ├── trello/callback/          # OAuth callback Trello
│   ├── api/telegram/route.ts     # Telegram webhook
│   └── layout.tsx                # Корневой layout
│
├── components/
│   ├── ui/                       # shadcn/ui компоненты
│   ├── encryption/               # Компоненты шифрования
│   │   ├── encryption-provider.tsx # Провайдер инициализации ключа
│   │   └── encryption-guard.tsx  # Guard для защиты контента
│   ├── providers/index.tsx       # Провайдеры (Clerk, Convex, Query)
│   ├── format-text.tsx           # Форматирование текста вопросов
│   └── question-image.tsx        # Отображение изображений
│
├── convex/                       # Convex backend
│   ├── schema.ts                 # Схема базы данных
│   ├── packages.ts               # CRUD пакетов
│   ├── tours.ts                  # CRUD туров
│   ├── questions.ts              # CRUD вопросов
│   ├── images.ts                 # Работа с изображениями
│   ├── integrations.ts           # Интеграции (Trello)
│   ├── telegram.ts               # Интеграция Telegram
│   ├── http.ts                   # HTTP endpoints (webhooks)
│   └── auth.config.ts            # Конфигурация Clerk
│
├── hooks/
│   ├── use-encryption.ts         # Хук чтения состояния шифрования
│   ├── use-trello.ts             # Интеграция Trello
│   ├── use-mobile.ts             # Определение мобильного устройства
│   └── use-telegram-channel.ts   # Работа с Telegram-каналами
│
├── stores/
│   ├── encryption.ts             # Zustand store шифрования
│   └── sidebar.ts                # Состояние сайдбара
│
├── lib/
│   ├── crypto/index.ts           # Криптографические функции
│   ├── db/                       # Работа с данными
│   │   ├── schema.ts             # TypeScript типы
│   │   ├── client.ts             # Convex клиент
│   │   └── encrypted-client.ts   # Шифрование/расшифровка
│   ├── parser/                   # Парсер вопросов (~1900 строк)
│   │   ├── index.ts              # Основной парсер
│   │   ├── docx.ts               # Парсинг DOCX
│   │   ├── txt.ts                # Парсинг TXT
│   │   ├── types.ts              # Типы парсера
│   │   ├── regexes.ts            # Регулярные выражения
│   │   └── compose-4s.ts         # Формат Compose-4
│   ├── export/                   # Экспортеры (~1900 строк)
│   │   ├── docx.ts               # Экспорт в DOCX
│   │   ├── pptx.ts               # Экспорт в PPTX
│   │   ├── chgk-db.ts            # Экспорт в CHGK-DB
│   │   ├── openquiz.ts           # Экспорт в OpenQuiz
│   │   ├── reddit.ts             # Экспорт для Reddit
│   │   ├── telegram.ts           # Экспорт в Telegram
│   │   └── utils.ts              # Утилиты (shuffle)
│   ├── trello/                   # Интеграция Trello
│   │   ├── client.ts             # OAuth и API клиент
│   │   ├── import.ts             # Импорт из Trello
│   │   └── parser.ts             # Парсинг карточек
│   ├── typography/               # Типографика
│   └── validation/               # Валидация (Zod)
│
├── tests/                        # Тесты
├── public/                       # Статические файлы
└── doc/                          # Документация
```

---

## E2E шифрование

### Обзор

Все пользовательские данные (пакеты, туры, вопросы, изображения) шифруются на клиенте с использованием **AES-256-GCM**. Сервер (Convex) хранит только зашифрованные blob-ы и не имеет доступа к содержимому.

Ключ шифрования хранится в Clerk unsafeMetadata. Это обеспечивает:
- Автоматическую инициализацию без ввода пароля
- Синхронизацию ключа между устройствами
- Разделение хранения: ключ в Clerk, данные в Convex

### Криптографические примитивы

| Операция | Алгоритм | Параметры |
|----------|----------|-----------|
| Шифрование данных | AES-256-GCM | 256-bit key, 96-bit IV |

### Иерархия ключей

```
Master Key (AES-256)
    │
    ├── хранится в памяти (Zustand, без persist)
    │
    └── экспортирован в base64 → Clerk unsafeMetadata
```

### Процесс инициализации (первый вход)

```typescript
// 1. Генерация master key
const masterKey = await generateAesKey();  // AES-256-GCM

// 2. Экспорт ключа
const exportedKey = await exportKey(masterKey);
const keyBase64 = arrayBufferToBase64(exportedKey);

// 3. Сохранение в Clerk
await user.update({
  unsafeMetadata: {
    ...user.unsafeMetadata,
    encryptionKey: keyBase64,
  },
});

// 4. Сохранение master key в памяти
useEncryptionStore.getState().setReady(masterKey);
```

### Процесс загрузки (последующие входы)

```typescript
// 1. Загрузка ключа из Clerk
const keyBase64 = user.unsafeMetadata.encryptionKey;

// 2. Импорт ключа
const keyData = base64ToArrayBuffer(keyBase64);
const masterKey = await importKey(keyData);

// 3. Сохранение в памяти
useEncryptionStore.getState().setReady(masterKey);
```

### Шифрование данных

```typescript
// Шифрование объекта
const encrypted = await encrypt(masterKey, {
  title: "Мой пакет",
  editor: "Автор",
  date: "2024-01-01",
});
// Результат: { ciphertext: "base64...", iv: "base64..." }

// Расшифровка
const data = await decrypt<PackageData>(masterKey, encrypted);
```

### Файлы криптографии

| Файл | Назначение |
|------|------------|
| `lib/crypto/index.ts` | Все криптографические функции |
| `stores/encryption.ts` | Zustand store для master key |
| `hooks/use-encryption.ts` | React хук для чтения состояния |
| `lib/db/encrypted-client.ts` | Обертка для шифрования/расшифровки данных |
| `components/encryption/encryption-provider.tsx` | Провайдер для инициализации ключа |
| `components/encryption/encryption-guard.tsx` | Guard для защиты контента |

---

## База данных (Convex)

### Схема

#### packages

Зашифрованные пакеты вопросов.

```typescript
packages: defineTable({
  userId: v.string(),           // Clerk user ID
  encryptedData: v.string(),    // base64 encrypted JSON {title, editor, date}
  iv: v.string(),               // base64 IV
  questionCount: v.number(),
  tourCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"])
```

#### tours

Зашифрованные туры внутри пакетов.

```typescript
tours: defineTable({
  userId: v.string(),
  packageId: v.id("packages"),
  encryptedData: v.string(),    // base64 encrypted JSON {title}
  iv: v.string(),
  orderNum: v.number(),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_package", ["packageId"])
```

#### questions

Зашифрованные вопросы.

```typescript
questions: defineTable({
  userId: v.string(),
  packageId: v.id("packages"),
  tourId: v.optional(v.id("tours")),
  encryptedData: v.string(),    // base64 encrypted JSON
  iv: v.string(),
  orderNum: v.number(),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_package", ["packageId"])
  .index("by_tour", ["tourId"])
```

Зашифрованные поля вопроса:
- `number` - номер вопроса
- `question` - текст вопроса
- `answer` - ответ
- `zachet` - зачетные ответы
- `nezachet` - незачетные ответы
- `comment` - комментарий
- `source` - источник
- `author` - автор
- `handout` - раздатка

#### images

Зашифрованные изображения (хранятся в Convex File Storage).

```typescript
images: defineTable({
  userId: v.string(),
  questionId: v.id("questions"),
  storageId: v.id("_storage"),  // ссылка на файл в Convex Storage
  iv: v.string(),               // IV для расшифровки на клиенте
  contentType: v.string(),      // MIME type (не зашифрован)
  filename: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_question", ["questionId"])
```

**Процесс загрузки изображения:**
1. Клиент шифрует изображение с помощью master key
2. Получает upload URL через `generateUploadUrl()`
3. Загружает зашифрованный blob по URL
4. Сохраняет метаданные (storageId, iv) в таблицу images

#### telegramLinkCodes

Временные коды для привязки Telegram-каналов.

```typescript
telegramLinkCodes: defineTable({
  code: v.string(),             // 6 символов, без префикса
  clerkUserId: v.string(),
  channelId: v.optional(v.string()),
  channelTitle: v.optional(v.string()),
  expiresAt: v.number(),        // TTL 10 минут
})
  .index("by_code", ["code"])
  .index("by_user", ["clerkUserId"])
```

#### telegramChannels

Привязанные Telegram-каналы.

```typescript
telegramChannels: defineTable({
  clerkUserId: v.string(),
  channelId: v.string(),
  channelTitle: v.optional(v.string()),
  linkedAt: v.number(),
})
  .index("by_user", ["clerkUserId"])
  .index("by_channel", ["channelId"])
  .index("by_user_channel", ["clerkUserId", "channelId"])
```

### API функции

#### packages.ts

| Функция | Тип | Описание |
|---------|-----|----------|
| `create` | mutation | Создание пакета |
| `list` | query | Список пакетов пользователя |
| `get` | query | Получение одного пакета |
| `update` | mutation | Обновление пакета |
| `updateCounts` | mutation | Обновление счетчиков |
| `remove` | mutation | Удаление пакета и всех связанных данных |

#### tours.ts

| Функция | Тип | Описание |
|---------|-----|----------|
| `create` | mutation | Создание тура |
| `listByPackage` | query | Туры пакета |
| `get` | query | Получение тура |
| `update` | mutation | Обновление тура |
| `updateOrder` | mutation | Изменение порядка |
| `remove` | mutation | Удаление тура |

#### questions.ts

| Функция | Тип | Описание |
|---------|-----|----------|
| `create` | mutation | Создание вопроса |
| `createBulk` | mutation | Массовое создание |
| `listByPackage` | query | Вопросы пакета |
| `listByTour` | query | Вопросы тура |
| `get` | query | Получение вопроса |
| `update` | mutation | Обновление вопроса |
| `updateOrder` | mutation | Изменение порядка |
| `remove` | mutation | Удаление вопроса |

#### images.ts

| Функция | Тип | Описание |
|---------|-----|----------|
| `generateUploadUrl` | mutation | Получение URL для загрузки |
| `create` | mutation | Сохранение метаданных после загрузки |
| `listByQuestion` | query | Изображения вопроса (с URL) |
| `get` | query | Получение изображения (с URL) |
| `remove` | mutation | Удаление изображения и файла |
| `removeByQuestion` | mutation | Удаление всех изображений вопроса |

#### telegram.ts

| Функция | Тип | Описание |
|---------|-----|----------|
| `createLinkCode` | mutation | Генерация кода привязки |
| `getLinkStatus` | query | Статус привязки |
| `getUserChannels` | query | Список каналов пользователя |
| `saveChannel` | mutation | Сохранение канала |
| `unlinkChannel` | mutation | Отвязка канала |
| `cancelLinking` | mutation | Отмена привязки |
| `verifyCodeInternal` | internalMutation | Проверка кода (webhook) |

---

## Парсер вопросов

### Обзор

Парсер — это TypeScript порт Python-библиотеки `chgksuite`. Поддерживает парсинг текстовых файлов и DOCX с извлечением структурированных вопросов.

### Поддерживаемые форматы

- **TXT** - простой текст с маркерами полей
- **DOCX** - Microsoft Word документы
- **Compose-4** - специальный формат ЧГК

### Структура вопроса

```typescript
interface Question {
  number?: number;        // Номер вопроса
  question: string;       // Текст вопроса
  answer?: string;        // Ответ
  zachet?: string;        // Зачетные ответы
  nezachet?: string;      // Незачетные ответы
  comment?: string;       // Комментарий
  source?: string;        // Источник
  author?: string;        // Автор
  handout?: string;       // Раздатка
}
```

### Использование

```typescript
import { ChgkParser } from "@/lib/parser";

// Парсинг текста
const parser = new ChgkParser();
const structure = parser.parse(text);

// Парсинг DOCX
import { parseDocxToHtml } from "@/lib/parser/docx";

const { html, images } = await parseDocxToHtml(file);
const structure = parser.parse(html);
```

### Распознаваемые маркеры

| Маркер | Поле |
|--------|------|
| `Вопрос N:`, `N.` | number |
| `Ответ:` | answer |
| `Зачет:`, `Зачёт:` | zachet |
| `Незачет:`, `Незачёт:` | nezachet |
| `Комментарий:` | comment |
| `Источник:` | source |
| `Автор:` | author |
| `Раздатка:` | handout |

### Файлы парсера

| Файл | Строк | Назначение |
|------|-------|------------|
| `index.ts` | 819 | Основная логика парсинга |
| `docx.ts` | 434 | Конвертация DOCX в HTML |
| `txt.ts` | 316 | Парсинг TXT |
| `types.ts` | 97 | TypeScript типы |
| `regexes.ts` | 64 | Регулярные выражения |
| `compose-4s.ts` | 139 | Формат Compose-4 |

---

## Экспорт данных

### Поддерживаемые форматы

| Формат | Файл | Описание |
|--------|------|----------|
| DOCX | `docx.ts` | Microsoft Word с форматированием |
| PPTX | `pptx.ts` | PowerPoint презентация |
| CHGK-DB | `chgk-db.ts` | SQLite база для CHGK Suite |
| OpenQuiz | `openquiz.ts` | XML формат для квизов |
| Reddit | `reddit.ts` | Markdown для Reddit |
| Telegram | `telegram.ts` | Форматирование для Telegram |

### DOCX экспорт

```typescript
import { exportToDocx } from "@/lib/export/docx";

const blob = await exportToDocx(questions, {
  includeAnswers: true,
  includeMetadata: true,
  spoilerMode: "whiten",  // none | whiten | pagebreak | dots
  shuffleQuestions: true,
  shuffleSeed: 12345,
  fontFamily: "Times New Roman",
  fontSize: 12,
});
```

**Режимы спойлеров:**
- `none` - ответы сразу после вопросов
- `whiten` - ответы белым цветом
- `pagebreak` - ответы на новой странице
- `dots` - ответы заменены точками

### PPTX экспорт

```typescript
import { exportToPptx } from "@/lib/export/pptx";

const blob = await exportToPptx(questions, {
  separateAnswerSlides: true,
  backgroundColor: "#1a1a1a",
  textColor: "#ffffff",
  fontFamily: "Arial",
  questionFontSize: 32,
  answerFontSize: 24,
});
```

### Утилиты экспорта

```typescript
import { shuffleQuestions } from "@/lib/export/utils";

// Случайное перемешивание
const shuffled = shuffleQuestions(questions);

// Детерминированное перемешивание (по seed)
const shuffled = shuffleQuestions(questions, { seed: 12345 });
```

---

## Интеграции

### Telegram

#### Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Клиент    │────►│   Convex    │────►│  Telegram   │
│  (React)    │◄────│  (webhook)  │◄────│    Bot      │
└─────────────┘     └─────────────┘     └─────────────┘
```

#### Процесс привязки канала

1. Пользователь нажимает "Привязать канал"
2. Генерируется код `CHGK-XXXXXX` (TTL 10 мин)
3. Пользователь добавляет бота в канал как администратора
4. Пользователь отправляет код в канал
5. Webhook получает сообщение, проверяет код
6. Канал сохраняется, сообщение удаляется
7. Бот отправляет подтверждение

#### Конфигурация

Переменные окружения:
```env
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx
```

#### Webhook endpoint

`POST /api/telegram` - обрабатывается в `app/api/telegram/route.ts`, перенаправляется в Convex `http.ts`.

### Trello

#### Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Клиент    │────►│   Trello    │     │   Convex    │
│  (React)    │◄────│    API      │     │  (token)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

#### OAuth flow

1. Пользователь нажимает "Подключить Trello"
2. Открывается popup с Trello авторизацией
3. Пользователь разрешает доступ
4. Токен шифруется и сохраняется в Convex (таблица integrations)

#### Импорт из Trello

```typescript
import { fetchBoards, fetchLists, fetchCards } from "@/lib/trello/client";
import { parseCard } from "@/lib/trello/parser";

const boards = await fetchBoards();
const lists = await fetchLists(boardId);
const cards = await fetchCards(listId);

const questions = cards.map(parseCard);
```

#### Формат карточки Trello

```
Текст вопроса на первой строке

Ответ: правильный ответ
Зачет: альтернативные ответы
Комментарий: комментарий к вопросу
Источник: источник информации
Автор: имя автора
```

---

## Компоненты UI

### shadcn/ui компоненты

| Компонент | Файл | Описание |
|-----------|------|----------|
| Button | `button.tsx` | Кнопки с вариантами |
| Dialog | `dialog.tsx` | Модальные окна |
| Input | `input.tsx` | Текстовые поля |
| Label | `label.tsx` | Метки форм |
| Card | `card.tsx` | Карточки |
| Tabs | `tabs.tsx` | Вкладки |
| Sidebar | `sidebar.tsx` | Боковая панель |
| Sheet | `sheet.tsx` | Выдвижные панели |
| Dropdown | `dropdown-menu.tsx` | Выпадающие меню |
| Tooltip | `tooltip.tsx` | Подсказки |
| Skeleton | `skeleton.tsx` | Загрузочные плейсхолдеры |
| Separator | `separator.tsx` | Разделители |
| Sonner | `sonner.tsx` | Toast уведомления |
| AlertDialog | `alert-dialog.tsx` | Диалоги подтверждения |

### Компоненты шифрования

#### EncryptionProvider

Провайдер для автоматической инициализации ключа шифрования.

```tsx
// В components/providers/index.tsx
<ClerkProvider>
  <ConvexProviderWithClerk>
    <EncryptionProvider>
      {children}
    </EncryptionProvider>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

При монтировании:
1. Проверяет `user.unsafeMetadata.encryptionKey`
2. Если есть - импортирует ключ
3. Если нет - генерирует и сохраняет в Clerk
4. Устанавливает ключ в Zustand store

#### EncryptionGuard

Обертка, ожидающая готовности шифрования.

```tsx
<EncryptionGuard>
  <ProtectedContent />
</EncryptionGuard>
```

Состояния:
- `loading` - показывает спиннер
- `error` - показывает ошибку
- `ready` - показывает children

### Специализированные компоненты

#### FormatText

Рендеринг форматированного текста вопроса.

```tsx
<FormatText
  text="Вопрос с _курсивом_ и __жирным__"
  images={questionImages}
/>
```

Поддерживаемое форматирование:
- `_текст_` - курсив
- `__текст__` - жирный
- `___текст___` - подчеркнутый
- `~текст~` - зачеркнутый
- `(img filename.png)` - изображение

#### QuestionImage

Отображение зашифрованного изображения.

```tsx
<QuestionImage
  imageId={id}
  alt="Изображение к вопросу"
/>
```

---

## Хуки и состояние

### useEncryption

Хук для чтения состояния шифрования.

```typescript
const {
  status,     // "loading" | "ready" | "error"
  masterKey,  // CryptoKey | null
  error,      // string | null
  isLoading,  // boolean
  isReady,    // boolean
} = useEncryption();
```

### useTrello

Хук для работы с интеграцией Trello.

```typescript
const {
  isLoading,    // boolean
  isConnected,  // boolean
  isReady,      // boolean (шифрование готово)
  getToken,     // () => Promise<string | null>
  saveToken,    // (token: string) => Promise<void>
  deleteToken,  // () => Promise<void>
} = useTrello();
```

### useTelegramChannels

Хук для работы с Telegram-каналами.

```typescript
const {
  isLoading,       // boolean
  isAuthenticated, // boolean
  channels,        // TelegramChannel[]
  linkStatus,      // LinkStatus | null
  startLinking,    // () => Promise<{ code: string; expiresAt: number }>
  saveChannel,     // () => Promise<void>
  unlinkChannel,   // (channelId: string) => Promise<void>
  cancelLinking,   // () => Promise<void>
} = useTelegramChannels();
```

### Zustand stores

#### useEncryptionStore

```typescript
interface EncryptionState {
  status: "loading" | "ready" | "error";
  masterKey: CryptoKey | null;
  error: string | null;
  setLoading: () => void;
  setReady: (key: CryptoKey) => void;
  setError: (error: string) => void;
  reset: () => void;
}
```

#### useSidebarStore

```typescript
interface SidebarState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}
```

---

## API и маршруты

### Страницы (App Router)

| Маршрут | Файл | Описание |
|---------|------|----------|
| `/` | `(dashboard)/page.tsx` | Список пакетов |
| `/new` | `(dashboard)/new/page.tsx` | Создание пакета |
| `/settings` | `(dashboard)/settings/page.tsx` | Настройки |
| `/[id]` | `(dashboard)/[id]/page.tsx` | Просмотр пакета |
| `/[id]/edit` | `(dashboard)/[id]/edit/page.tsx` | Редактор |
| `/[id]/export` | `(dashboard)/[id]/export/page.tsx` | Экспорт |
| `/help` | `(dashboard)/help/page.tsx` | Справка и FAQ |
| `/sign-in` | `sign-in/[[...sign-in]]/page.tsx` | Вход |
| `/sign-up` | `sign-up/[[...sign-up]]/page.tsx` | Регистрация |
| `/trello/callback` | `trello/callback/page.tsx` | OAuth callback |

### API Routes

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/telegram` | POST | Telegram webhook |

### Convex HTTP endpoints

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/tg-webhook` | POST | Telegram bot webhook |

---

## Разработка

### Команды

```bash
# Установка зависимостей
bun install

# Запуск dev сервера
bun dev

# Сборка
bun build

# Линтинг
bun lint

# Исправление линтинга
bun lint:fix

# Форматирование
bun format

# Тесты
bun test
```

### Переменные окружения

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx

# Convex
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOY_KEY=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx

# Trello
NEXT_PUBLIC_TRELLO_API_KEY=xxx
```

### Структура коммитов

Используется Conventional Commits:

```
feat: добавить экспорт в PPTX
fix: исправить парсинг многострочных ответов
docs: обновить README
refactor: переработать криптографию
test: добавить тесты парсера
```

---

## Безопасность

### Принципы

1. **Разделение хранения**: ключ в Clerk, данные в Convex
2. **Client-side encryption**: шифрование происходит только в браузере
3. **Strong cryptography**: AES-256-GCM
4. **Memory-only keys**: master key не сохраняется на диск

### Модель угроз

| Угроза | Защита |
|--------|--------|
| Компрометация Convex | Данные зашифрованы, ключа нет на сервере |
| Перехват трафика | HTTPS + E2E шифрование |
| XSS атака | CSP, санитизация, React escaping |

### Компромиссы

Это "E2E-lite" - упрощенная модель с автоматической инициализацией:
- **Плюс**: не нужно вводить пароль, автоматическая синхронизация
- **Минус**: при компрометации Clerk злоумышленник получит ключ

### Ограничения

- При компрометации Clerk данные могут быть расшифрованы
- Master key в памяти браузера (уязвим к extensions)
- Метаданные (количество пакетов, даты) видны серверу

---

## Пользовательские инструкции

### Встроенная справка

Приложение содержит встроенную справку доступную по адресу `/help`. Она включает:

- **Начало работы** - создание пакетов, импорт
- **Шифрование** - как работает автоматическое шифрование
- **Работа с вопросами** - поля, форматирование, изображения
- **Импорт данных** - форматы DOCX, TXT, Trello
- **Экспорт данных** - доступные форматы и опции
- **Telegram интеграция** - привязка каналов, публикация

### Контекстные подсказки

В интерфейсе есть подсказки:

1. **Страница создания пакета** - раскрывающиеся блоки с форматами файлов DOCX/TXT и форматом карточек Trello

2. **Страница настроек** - информация о статусе шифрования и привязанных каналах

### Навигация

Справка доступна из главного меню в сайдбаре (иконка "?").

---

## Глоссарий

| Термин | Описание |
|--------|----------|
| **ЧГК** | Что? Где? Когда? - интеллектуальная игра |
| **Пакет** | Набор вопросов для игры |
| **Тур** | Раздел пакета (обычно 12-15 вопросов) |
| **Зачет** | Альтернативные правильные ответы |
| **Незачет** | Ответы, которые не засчитываются |
| **Раздатка** | Материалы, выдаваемые командам |
| **E2E** | End-to-end (сквозное шифрование) |
| **Master Key** | Основной ключ шифрования данных (AES-256) |
