"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  Bell,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Landmark,
  Languages,
  ListTree,
  Loader2,
  MapPin,
  Package,
  Layers,
  LockKeyhole,
  Palette,
  Percent,
  Ruler,
  Search,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UsersSection } from "@/components/settings/users-section";
import { BranchesSection } from "@/components/settings/branches-section";
import { SizesSection } from "@/components/settings/sizes-section";
import { ColorsSection } from "@/components/settings/colors-section";
import { ThemeSection } from "@/components/settings/theme-section";
import { ScreenLockSection } from "@/components/settings/screen-lock-section";
import { MenusSection } from "@/components/settings/menus-section";
import { MenuRightsSection } from "@/components/settings/menu-rights-section";
import { WebsiteSettingsSection } from "@/components/settings/website-settings-section";
import { ShippingSection } from "@/components/settings/shipping-section";
import { CouriersSection } from "@/components/settings/couriers-section";
import { PickupLocationsSection } from "@/components/settings/pickup-locations-section";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { changePassword } from "@/lib/auth-api";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/validations";

type SectionKey =
  | "general"
  | "account"
  | "screen-lock"
  | "users"
  | "branches"
  | "sizes"
  | "colors"
  | "theme"
  | "menus"
  | "menu-rights"
  | "shipping"
  | "couriers"
  | "pickup-locations";

const settingsNav: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  key?: SectionKey;
}[] = [
  { label: "General", icon: Store, key: "general" },
  { label: "Account", icon: UserRound, key: "account" },
  { label: "Screen lock", icon: LockKeyhole, key: "screen-lock" },
  { label: "Users", icon: Users, key: "users" },
  { label: "Branches", icon: Building2, key: "branches" },
  { label: "Sizes", icon: Ruler, key: "sizes" },
  { label: "Colors", icon: Palette, key: "colors" },
  { label: "Theme", icon: Layers, key: "theme" },
  { label: "Menus", icon: ListTree, key: "menus" },
  { label: "Menu rights", icon: ShieldCheck, key: "menu-rights" },
  { label: "Plan", icon: Package },
  { label: "Payments", icon: CreditCard },
  { label: "Checkout", icon: ShoppingCart },
  { label: "Customer accounts", icon: UserRound },
  { label: "Shipping and delivery", icon: Truck, key: "shipping" },
  { label: "Couriers", icon: Truck, key: "couriers" },
  { label: "Pickup locations", icon: MapPin, key: "pickup-locations" },
  { label: "Taxes and duties", icon: Percent },
  { label: "Locations", icon: MapPin },
  { label: "Apps", icon: AppWindow },
  { label: "Sales channels", icon: Share2 },
  { label: "Domains", icon: Globe },
  { label: "Notifications", icon: Bell },
  { label: "Languages", icon: Languages },
  { label: "Customer privacy", icon: ShieldCheck },
  { label: "Policies", icon: FileText },
  { label: "Billing", icon: Landmark },
];

const sectionMeta: Record<
  SectionKey,
  { title: string; icon: React.ComponentType<{ className?: string }> }
> = {
  general: { title: "General", icon: Store },
  account: { title: "Account", icon: UserRound },
  "screen-lock": { title: "Screen Lock", icon: LockKeyhole },
  users: { title: "Users", icon: Users },
  branches: { title: "Branches", icon: Building2 },
  sizes: { title: "Sizes", icon: Ruler },
  colors: { title: "Colors", icon: Palette },
  theme: { title: "Theme", icon: Layers },
  menus: { title: "Menus", icon: ListTree },
  "menu-rights": { title: "Menu rights", icon: ShieldCheck },
  shipping: { title: "Shipping & Delivery", icon: Truck },
  couriers: { title: "Couriers", icon: Truck },
  "pickup-locations": { title: "Pickup Locations", icon: MapPin },
};

function ChangePasswordSection() {
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordValues) => {
    try {
      const message = await changePassword(values);
      toast.success(message);
      reset();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't change password."));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Change password</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            Update your account password. You&apos;ll need your current password to confirm.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  className="pr-10"
                  aria-invalid={!!errors.currentPassword}
                  {...register("currentPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="pr-10"
                  aria-invalid={!!errors.newPassword}
                  {...register("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = React.useState("");
  const [section, setSection] = React.useState<SectionKey>("general");
  const SectionIcon = sectionMeta[section].icon;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const visibleNav = settingsNav.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  const initials = (user?.name ?? "MF").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-40 bg-[#1a1a1a]">
      <div className="size-full overflow-y-auto rounded-t-xl bg-background">
        <button
          onClick={() => router.push("/")}
          aria-label="Close settings"
          className="fixed top-[4.25rem] right-4 z-50 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="mx-auto flex max-w-6xl items-start gap-8 px-4 py-8 md:px-8">
          {/* Settings navigation */}
          <aside className="sticky top-8 hidden w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-black/8 md:flex">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold">modeFirst</p>
              <p className="text-xs text-muted-foreground">1 store</p>
            </div>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="h-8 pl-8"
                />
              </div>
            </div>
            <nav className="max-h-[62vh] overflow-y-auto px-2 pb-2">
              {visibleNav.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.key && setSection(item.key)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors duration-150",
                    item.key === section
                      ? "bg-[#f1f1f1] text-foreground"
                      : "text-foreground/80 hover:bg-[#f1f1f1]/70"
                  )}
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
              {visibleNav.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No settings found
                </p>
              )}
            </nav>
            <Separator />
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand text-xs font-bold text-brand-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium capitalize">
                  {user?.name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
          </aside>

          {/* Settings content */}
          <div className="min-w-0 flex-1 pb-16">
            {/* Mobile section switcher */}
            <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
              {(Object.keys(sectionMeta) as SectionKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                    key === section
                      ? "bg-[#e3e3e3] text-foreground"
                      : "bg-card text-foreground/80 ring-1 ring-black/8"
                  )}
                >
                  {sectionMeta[key].title}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <SectionIcon className="size-5" />
              <h1 className="text-xl font-bold">{sectionMeta[section].title}</h1>
            </div>

            {section === "account" && <ChangePasswordSection />}
            {section === "screen-lock" && <ScreenLockSection />}
            {section === "users" && <UsersSection />}
            {section === "branches" && <BranchesSection />}
            {section === "sizes" && <SizesSection />}
            {section === "colors" && <ColorsSection />}
            {section === "theme" && <ThemeSection />}
            {section === "menus" && <MenusSection />}
            {section === "menu-rights" && <MenuRightsSection />}

            {section === "general" && <WebsiteSettingsSection />}
            {section === "shipping" && <ShippingSection />}
            {section === "couriers" && <CouriersSection />}
            {section === "pickup-locations" && <PickupLocationsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
