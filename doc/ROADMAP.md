# Roadmap: CHGK-Web

## Текущий статус

Проект использует:
- Локальную БД (sql.js + IndexedDB) для пакетов/вопросов
- Convex для привязки Telegram каналов (real-time)
- Clerk для авторизации
- Telegram Bot API для экспорта в каналы

Все интеграции настроены и работают. E2E шифрование пока не реализовано.

### Реализовано

- [x] Next.js 16 проект с App Router
- [x] SQLite в браузере (sql.js + IndexedDB)
- [x] Базовый UI: список пакетов, просмотр, импорт
- [x] Парсер DOCX (mammoth.js)
- [x] Регулярные выражения для полей (вопрос, ответ, зачет, источник, автор и др.)
- [x] Типографика (кавычки, тире, ударения, пробелы)
- [x] Экспорт в .4s формат
- [x] Экспорт в DOCX (со спойлерами)
- [x] Экспорт в PPTX
- [x] Удаление пакетов с подтверждением
- [x] Нумерация вопросов из оригинала
- [x] Тесты парсера (23 pass)
- [x] Извлечение изображений из DOCX
- [x] Отображение изображений в UI
- [x] Обработка HTML таблиц в markdown
- [x] Clerk авторизация
- [x] Convex интеграция (real-time)
- [x] Telegram привязка каналов (CHGK-XXXXXX)
- [x] Страница настроек (управление интеграциями Telegram/Trello)
- [x] Навигация: кнопки "Назад" на всех страницах
- [x] Сайдбар: сохранение состояния (zustand persist)
- [x] Сайдбар: аватар и кнопка выхода
- [x] Telegram экспорт: остановка при первой ошибке
- [x] Telegram экспорт: предупреждение при уходе со страницы
- [x] Виртуализация списков (TanStack Virtual)
- [x] Drag-n-drop вопросов в редакторе (dnd-kit)
- [x] Валидация форм (Zod)

---

## Полный список функциональности chgksuite

### 1. Парсер (parse)

| Функция | Статус | Приоритет |
|---------|--------|-----------|
| Парсинг DOCX | Done | - |
| Парсинг TXT | - | Low |
| Поля: question, answer, zachet, nezachet | Done | - |
| Поля: comment, source, author, handout | Done | - |
| Поля: number, date, editor | Done | - |
| Сохранение форматирования (bold/italic) | - | Medium |
| Извлечение изображений из DOCX | Done | - |
| Обработка ссылок | Done | - |
| Автоопределение кодировки TXT | - | Low |
| Языковые регулярки (ru, en, ua, by, и др.) | Partial | Low |

### 2. Типографика (typotools)

| Функция | Статус | Приоритет |
|---------|--------|-----------|
| Умные кавычки | Done | - |
| Замена дефисов на тире | Done | - |
| Неразрывные пробелы | Done | - |
| Исправление ударений | Done | - |
| Удаление лишних пробелов | Done | - |
| Percent-декодирование URL | Done | - |

### 3. Экспорт (compose)

| Формат | Статус | Приоритет |
|--------|--------|-----------|
| .4s (внутренний) | Done | - |
| DOCX | Done | - |
| PPTX | Done | - |
| LaTeX/PDF | - | Low |
| Telegram | Done | - |
| LiveJournal | - | Low |
| Reddit (Markdown) | - | Low |
| db.chgk.info | Done | - |
| OpenQuiz (JSON) | - | Low |

### 4. Экспорт DOCX - детали

| Опция | Описание | Статус |
|-------|----------|--------|
| Базовый экспорт | Вопросы + ответы | Done |
| Спойлеры whiten | Белый текст | Done |
| Спойлеры pagebreak | На новой странице | Done |
| Спойлеры dots | Точки вместо ответа | - |
| Screen mode | Версия для экрана + ведущего | - |
| Без ответов (noanswers) | Только вопросы | Done |
| Рандомизация | Перемешать вопросы | - |
| Кастомный шаблон | Свой docx template | - |
| Выбор шрифта | font_face | Done |

### 5. Экспорт PPTX - детали

| Опция | Описание | Статус |
|-------|----------|--------|
| Базовый экспорт | Слайд на вопрос | Done |
| Конфигурация слайдов | Размеры, цвета, шрифты | Done |
| Изображения | Встраивание картинок | Done |
| Номера вопросов | disable_numbers | Done |

### 6. Экспорт Telegram

| Опция | Описание | Статус |
|-------|----------|--------|
| Постинг в канал | Через Bot API | Done |
| Спойлеры | `<tg-spoiler>` тег | Done |
| Привязка каналов | Верификация через код CHGK-XXXXXX | Done |
| Множественные каналы | Несколько каналов на пользователя | Done |
| Авторизация | Проверка владения каналом | Done |
| Изображения | Через Imgur | - |

### 7. Интеграции

| Интеграция | Статус | Приоритет |
|------------|--------|-----------|
| Trello download | Done | - |
| Trello upload | - | Low |
| rating.chgk.net (статистика) | - | Low |
| db.chgk.info (парсинг) | - | Low |
| Imgur (загрузка изображений) | - | Medium |

### 8. Раздатки (handouts)

| Функция | Статус | Приоритет |
|---------|--------|-----------|
| Генерация из .4s | - | Low |
| Вёрстка в PDF (Tectonic) | - | Low |
| Упаковка по командам | - | Low |

### 9. Изображения

| Функция | Статус | Приоритет |
|---------|--------|-----------|
| Извлечение из DOCX | Done | - |
| Масштабирование | - | Low |
| Хранение в IndexedDB | Done | - |
| Загрузка на Imgur | - | Medium |
| Отображение в UI | Done | - |

---

## Следующие задачи (по приоритету)

### High Priority

1. ~~**Редактор вопросов** - страница редактирования пакета~~ DONE
   - Редактирование полей вопроса
   - Добавление/удаление вопросов
   - Перемещение вопросов

2. ~~**Сохранение форматирования** - bold/italic из DOCX~~ DONE
   - Формат: `_italic_`, `__bold__`, `___underline___`, `~strike~`
   - Опция `preserveFormatting` в парсере
   - Отображение в UI (FormatText)
   - Экспорт в DOCX с форматированием

### Medium Priority

3. ~~**Telegram экспорт**~~ DONE
   - Bot API для постинга
   - Спойлеры для ответов (`<tg-spoiler>`)
   - HTML форматирование

4. ~~**Trello интеграция**~~ DONE
   - Авторизация через браузер (popup)
   - Импорт карточек как вопросов
   - Списки как туры

5. ~~**Экспорт db.chgk.info**~~ DONE
   - Текстовый формат для базы вопросов
   - Теги: `<раздатка>`, `(pic:)`

### Low Priority

6. **Парсинг TXT**
7. **LaTeX/PDF экспорт**
8. **Рандомизация вопросов**
9. **Раздатки (handouts)**
10. ~~**Авторизация Clerk + Convex**~~ DONE (для Telegram каналов)
11. **E2E шифрование пакетов**
12. **Синхронизация пакетов через Convex**

---

## Настройка Clerk + Convex + Telegram

**Статус: Настроено**

- Clerk: `REDACTED.clerk.accounts.dev`
- Convex: `REDACTED.convex.cloud`
- Telegram Bot: `@REDACTED_bot`

### Переменные окружения

**.env.local:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CONVEX_URL=https://REDACTED.convex.cloud
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

**Convex Dashboard (Settings -> Environment Variables):**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `CLERK_JWT_ISSUER_DOMAIN` = `https://REDACTED.clerk.accounts.dev`

### Настройка webhook (при необходимости)

HTTP routes в Convex используют домен `.convex.site` (не `.convex.cloud`).

```bash
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://REDACTED.convex.site/tg-webhook",
    "secret_token": "{TELEGRAM_WEBHOOK_SECRET}"
  }'
```

---

## Верификация

### Тестирование парсера
- `bun test` - запуск тестов (23 pass)

### Тестирование экспорта
- Открыть экспортированные файлы в Word/PowerPoint
- Сравнить с результатами chgksuite

### Тестирование UI
- `bun dev` - запуск dev сервера
- Проверить импорт, просмотр, экспорт
