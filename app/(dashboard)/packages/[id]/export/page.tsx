"use client";

import { FileDown, FileText, Presentation, Send } from "lucide-react";
import { useParams } from "next/navigation";

export default function ExportPackagePage() {
  const params = useParams();
  const packageId = params.id as string;

  const exportOptions = [
    {
      id: "docx",
      name: "DOCX",
      description: "Документ Word",
      icon: FileText,
    },
    {
      id: "pptx",
      name: "PPTX",
      description: "Презентация PowerPoint",
      icon: Presentation,
    },
    {
      id: "telegram",
      name: "Telegram",
      description: "Формат для Telegram",
      icon: Send,
    },
    {
      id: "4s",
      name: ".4s",
      description: "Формат SI Game",
      icon: FileDown,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Экспорт пакета</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {exportOptions.map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={() => {
              // TODO: Implement export
              console.log("Export:", option.id, packageId);
            }}
            className="flex items-start gap-4 rounded-lg border p-4 text-left hover:border-primary transition-colors"
          >
            <option.icon className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">{option.name}</div>
              <div className="text-sm text-muted-foreground">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
