"use client";

import { useParams } from "next/navigation";

export default function EditPackagePage() {
  const params = useParams();
  const packageId = params.id as string;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Редактирование пакета</h1>
      <p className="text-muted-foreground">Редактор в разработке. ID: {packageId}</p>
    </div>
  );
}
