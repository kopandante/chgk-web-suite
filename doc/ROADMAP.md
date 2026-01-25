# Roadmap: CHGK Web Suite

## Текущий статус

Проект использует:
- Convex для хранения зашифрованных данных (пакеты, вопросы, изображения)
- Clerk для авторизации и хранения ключа шифрования
- Telegram Bot API для экспорта в каналы
- E2E шифрование (AES-256-GCM, ключ в Clerk unsafeMetadata)

Все основные функции реализованы.

---

## Реализовано

- [x] Next.js 16 с App Router
- [x] Convex (real-time база данных)
- [x] Clerk авторизация
- [x] E2E шифрование (ключ в Clerk metadata)
- [x] Парсер DOCX и TXT
- [x] Типографика (кавычки, тире, ударения, пробелы)
- [x] Экспорт: DOCX, PPTX, Telegram, CHGK-DB, OpenQuiz, Reddit
- [x] Импорт из Trello
- [x] Telegram: привязка каналов, публикация с спойлерами
- [x] Редактор вопросов с drag-n-drop
- [x] Извлечение и отображение изображений из DOCX
- [x] Рандомизация вопросов
- [x] Виртуализация списков

---

## Не реализовано

### Medium Priority

| Функция | Описание |
|---------|----------|
| Форматирование при парсинге | Сохранение bold/italic из DOCX |
| Imgur интеграция | Загрузка изображений для Telegram |

### Low Priority

| Функция | Описание |
|---------|----------|
| LaTeX/PDF экспорт | Генерация PDF через LaTeX |
| Screen mode DOCX | Версия для экрана + ведущего |
| Кастомный шаблон DOCX | Свой .docx template |
| Trello upload | Выгрузка вопросов обратно в Trello |
| db.chgk.info парсинг | Импорт пакетов из базы вопросов |
| rating.chgk.net | Интеграция со статистикой |
| Раздатки (handouts) | Генерация PDF раздаток |
| LiveJournal экспорт | Форматирование для ЖЖ |
| Автокодировка TXT | Определение кодировки при импорте |
| Языковые регулярки | Поддержка en, ua, by |

---

## Настройка окружения

### Переменные окружения (.env.local)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
NEXT_PUBLIC_TRELLO_API_KEY=...
```

### Convex Dashboard

Environment Variables:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `CLERK_JWT_ISSUER_DOMAIN`

---

## Команды

```bash
bun dev          # Запуск dev сервера
bun run build    # Сборка
bun lint         # Проверка Biome
bun test         # Тесты парсера
```
