"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import {
  BookOpen,
  ChevronRight,
  Download,
  Edit,
  HelpCircle,
  LogOut,
  Moon,
  Package,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { EncryptionGuard } from "@/components/encryption";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEncryption } from "@/hooks/use-encryption";
import { decryptPackage } from "@/lib/db/encrypted-client";
import { useHeaderActionsStore } from "@/stores/header-actions";

const navItems = [
  { href: "/packages", label: "Пакеты", icon: Package },
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/help", label: "Справка", icon: HelpCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isReady, masterKey } = useEncryption();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const headerActions = useHeaderActionsStore((state) => state.actions);
  const [packageTitle, setPackageTitle] = useState<string | null>(null);

  // Извлекаем packageId из pathname
  const packageIdMatch = pathname.match(/^\/([^/]+)/);
  const packageId =
    packageIdMatch && !["packages", "settings", "help", "new"].includes(packageIdMatch[1])
      ? (packageIdMatch[1] as Id<"packages">)
      : null;

  // Проверяем, находимся ли на странице просмотра пакета (не edit/export)
  const isPackageViewPage = packageId && pathname.match(/^\/[^/]+$/);

  const deletePackageMutation = useConvexMutation(api.packages.remove);

  const handleDelete = async () => {
    if (!packageId) return;
    await deletePackageMutation({ id: packageId });
    router.push("/packages");
  };

  const encryptedPkg = useConvexQuery(api.packages.get, packageId ? { id: packageId } : "skip");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Сбрасываем название при смене пакета
  // biome-ignore lint/correctness/useExhaustiveDependencies: packageId нужен для сброса при смене пакета
  useEffect(() => {
    setPackageTitle(null);
  }, [packageId]);

  useEffect(() => {
    if (!encryptedPkg || !masterKey) {
      return;
    }
    decryptPackage(masterKey, encryptedPkg)
      .then((pkg) => setPackageTitle(pkg.title))
      .catch(() => setPackageTitle(null));
  }, [encryptedPkg, masterKey]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Определяем breadcrumbs на основе pathname
  const getBreadcrumbs = (): { href?: string; label: string }[] => {
    const pkgLabel = packageTitle || "...";

    if (pathname === "/packages") {
      return [{ label: "Пакеты" }];
    }
    if (pathname === "/settings") {
      return [{ label: "Настройки" }];
    }
    if (pathname === "/help") {
      return [{ label: "Справка" }];
    }
    if (pathname === "/new") {
      return [{ href: "/packages", label: "Пакеты" }, { label: "Новый пакет" }];
    }
    // /[id]/grid/[questionId]
    const gridQuestionMatch = pathname.match(/^\/([^/]+)\/grid\/([^/]+)$/);
    if (gridQuestionMatch) {
      return [
        { href: "/packages", label: "Пакеты" },
        { href: `/${gridQuestionMatch[1]}`, label: pkgLabel },
        { href: `/${gridQuestionMatch[1]}/grid`, label: "Сетка" },
        { label: "Редактирование" },
      ];
    }
    // /[id]/grid
    const gridMatch = pathname.match(/^\/([^/]+)\/grid$/);
    if (gridMatch) {
      return [
        { href: "/packages", label: "Пакеты" },
        { href: `/${gridMatch[1]}`, label: pkgLabel },
        { label: "Сетка" },
      ];
    }
    // /[id]/export
    const exportMatch = pathname.match(/^\/([^/]+)\/export$/);
    if (exportMatch) {
      return [
        { href: "/packages", label: "Пакеты" },
        { href: `/${exportMatch[1]}`, label: pkgLabel },
        { label: "Экспорт" },
      ];
    }
    // /[id] (просмотр пакета)
    const viewMatch = pathname.match(/^\/([^/]+)$/);
    if (viewMatch && !["packages", "settings", "help"].includes(viewMatch[1])) {
      return [{ href: "/packages", label: "Пакеты" }, { label: pkgLabel }];
    }
    return [];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <SidebarProvider>
      <Sidebar className="border-r-0">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <Link href="/packages" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">
                CHGK Web Suite
              </span>
            </Link>
            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-md p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                title={resolvedTheme === "dark" ? "Светлая тема" : "Тёмная тема"}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-9 px-3 rounded-md transition-colors"
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {user?.imageUrl ? (
              <Image src={user.imageUrl} alt="" width={32} height={32} className="rounded-full" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-xs font-medium text-sidebar-accent-foreground">
                  {(
                    user?.firstName?.[0] ||
                    user?.emailAddresses[0]?.emailAddress?.[0] ||
                    "?"
                  ).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-sidebar-foreground truncate">
                {user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "User"}
              </p>
              <div className="flex items-center gap-1.5">
                <div
                  className={`status-dot ${isReady ? "status-dot-success" : "status-dot-warning"}`}
                />
                <span className="text-xs text-sidebar-foreground/50">
                  {isReady ? "E2E" : "..."}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-md p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background flex flex-col h-screen overflow-hidden">
        <header className="flex-none flex h-12 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.label} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-foreground">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPackageViewPage && packageId && (
              <>
                <Link
                  href={`/${packageId}/grid`}
                  className="btn-outline px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Сетка
                </Link>
                <Link
                  href={`/${packageId}/export`}
                  className="btn-primary px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Экспорт
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить пакет?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Пакет {packageTitle ? `"${packageTitle}"` : ""} будет удален вместе со всеми
                        вопросами.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {headerActions}
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
          <EncryptionGuard>{children}</EncryptionGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
