import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ScreenLock } from "@/components/layout/screen-lock";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ScreenLock>
        {/* Black band under the top bar so the canvas corners curve against it, Shopify-style */}
        <SidebarProvider className="bg-[linear-gradient(to_bottom,#1a1a1a_calc(3.5rem+12px),var(--sidebar)_calc(3.5rem+12px))] pt-14">
          <TopBar />
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-background md:rounded-tr-xl">
            <main className="w-full flex-1 px-4 py-6 md:px-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </ScreenLock>
    </AuthGuard>
  );
}
