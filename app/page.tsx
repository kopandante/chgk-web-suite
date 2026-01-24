import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">CHGK Web</h1>
        <p className="text-lg text-muted-foreground">
          Веб-приложение для работы с пакетами вопросов ЧГК. Импорт из DOCX, редактирование, экспорт
          в различные форматы.
        </p>
        <p className="text-sm text-muted-foreground">
          Все данные хранятся локально в вашем браузере.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/packages"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Открыть приложение
          </Link>
        </div>
      </div>
    </main>
  );
}
