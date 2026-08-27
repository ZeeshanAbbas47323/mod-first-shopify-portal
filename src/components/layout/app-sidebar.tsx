"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Globe,
  Inbox,
  Home,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Star,
  Tag,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { orders } from "@/lib/mock-data";

interface NavChild {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: NavChild[];
}

const mainNav: NavItem[] = [
  { title: "Home", href: "/", icon: Home },
  {
    title: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    badge: orders.filter((o) => o.fulfillmentStatus === "Unfulfilled").length,
    children: [
      { title: "Drafts", href: "/orders/drafts" },
      { title: "Shipping labels", href: "/orders/shipping-labels" },
      { title: "Abandoned checkouts", href: "/orders/abandoned-checkouts" },
    ],
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    children: [
      { title: "Categories", href: "/products/categories" },
      { title: "Collections", href: "/products/collections" },
      { title: "Inventory", href: "/products/inventory" },
      { title: "Design uploads", href: "/products/designs" },
    ],
  },
  {
    title: "POS",
    href: "/pos",
    icon: Store,
    children: [
      { title: "Shifts", href: "/pos/shifts" },
      { title: "Devices", href: "/pos/devices" },
      { title: "Card terminals", href: "/pos/terminals" },
    ],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    children: [{ title: "Wishlists", href: "/customers/wishlists" }],
  },
  { title: "Marketing", href: "/marketing", icon: Megaphone },
  {
    title: "Discounts",
    href: "/discounts",
    icon: Tag,
    children: [{ title: "Discount tiers", href: "/discounts/tiers" }],
  },
  {
    title: "Content",
    href: "/content",
    icon: FileText,
    children: [{ title: "Pages", href: "/content/pages" }],
  },
  {
    title: "Inquiries",
    href: "/inquiries",
    icon: Inbox,
    children: [{ title: "Net 30 applications", href: "/inquiries/net30" }],
  },
  { title: "Reviews", href: "/reviews", icon: Star },
  { title: "Markets", href: "/markets", icon: Globe },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
];

const itemClasses =
  "cursor-pointer font-medium transition-colors duration-150 hover:bg-[#e0e0e0] active:bg-[#e0e0e0] data-active:bg-white data-active:shadow-sm data-active:hover:bg-white";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="offcanvas"
      className="top-14 !h-[calc(100svh-3.5rem)] bg-[#1a1a1a] **:data-[slot=sidebar-inner]:rounded-tl-xl"
    >
      <SidebarContent>
        <SidebarGroup className="pt-3">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const sectionActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                // Parent shows the white pill only when it's the exact page;
                // when a child is active the child gets the pill instead.
                const childActive = item.children?.some(
                  (c) => pathname === c.href
                );
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={sectionActive && !childActive}
                      className={itemClasses}
                    >
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge className="rounded-full bg-white text-[11px] font-semibold text-foreground shadow-sm">
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                    {item.children && sectionActive ? (
                      <SidebarMenuSub className="mt-0.5 border-sidebar-border">
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton
                              render={<Link href={child.href} />}
                              isActive={pathname === child.href}
                              className={itemClasses}
                            >
                              <span>{child.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname.startsWith("/settings")}
              className={itemClasses}
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
