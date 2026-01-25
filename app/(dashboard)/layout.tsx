"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { BookOpen, HelpCircle, LogOut, Package, Settings, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EncryptionGuard } from "@/components/encryption";
import { Separator } from "@/components/ui/separator";
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
import { useEncryption } from "@/hooks/use-encryption";

const navItems = [
  { href: "/packages", label: "Мои пакеты", icon: Package },
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/help", label: "Справка", icon: HelpCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isReady } = useEncryption();

  return (
    <SidebarProvider>
      <Sidebar className="border-r-0">
        <SidebarHeader className="p-5 border-b border-sidebar-border">
          <Link href="/packages" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <BookOpen className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <span className="font-display font-semibold text-sidebar-foreground tracking-tight">
                CHGK Web Suite
              </span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-3">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-11 px-4 rounded-lg transition-all"
                      >
                        <Link href={item.href}>
                          <item.icon className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt=""
                width={36}
                height={36}
                className="rounded-full ring-2 ring-sidebar-border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center ring-2 ring-sidebar-border">
                <span className="text-sm font-semibold text-sidebar-accent-foreground">
                  {(
                    user?.firstName?.[0] ||
                    user?.emailAddresses[0]?.emailAddress?.[0] ||
                    "?"
                  ).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.firstName || user?.emailAddresses[0]?.emailAddress || "Пользователь"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user?.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg p-2.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-6">
          <SidebarTrigger className="-ml-2" />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
            />
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {isReady ? "Зашифрованное хранилище" : "Инициализация шифрования..."}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <EncryptionGuard>{children}</EncryptionGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
