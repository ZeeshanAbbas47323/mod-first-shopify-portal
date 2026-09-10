"use client";

import * as React from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaUpload } from "@/components/media-upload";
import {
  apiErrorMessage,
  changePassword,
  getProfile,
  updateProfile,
} from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { imgUrl, parseServerDate } from "@/lib/utils";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/validations";

const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Keep it under 100 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Keep it under 20 characters")
    .or(z.literal("")),
  image: z.string().nullable().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

interface Profile {
  id?: number;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  role_label?: string;
  image?: string | null;
  branch?: { name?: string } | null;
  created_at?: string;
  last_activity_at?: string;
}

function humanize(value?: string | null) {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value?: string | null) {
  const date = parseServerDate(value);
  return date ? format(date, "d MMM yyyy") : "—";
}

/** A labelled read-only fact in the identity card. */
function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-card ring-1 ring-black/8">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-[#f7f7f7] px-5 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const authUser = useAuthStore((s) => s.user);
  const authLogin = useAuthStore((s) => s.login);
  const authToken = useAuthStore((s) => s.token);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", phone: "", image: null },
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getProfile()) as Profile;
      const record = (data as { user?: Profile })?.user ?? data;
      setProfile(record);
      reset({
        full_name: record?.full_name ?? "",
        phone: record?.phone ?? "",
        image: record?.image ?? null,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't load your profile."));
    } finally {
      setLoading(false);
    }
  }, [reset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const image = watch("image");
  const fullName = watch("full_name");

  const onSubmit = async (values: ProfileValues) => {
    try {
      const message = await updateProfile({
        full_name: values.full_name,
        ...(values.phone ? { phone: values.phone } : {}),
        image: values.image ?? null,
      });

      // Reflect the new name in the top bar without a reload.
      if (authToken) {
        authLogin(
          {
            name: values.full_name,
            email: profile?.email ?? authUser?.email ?? "",
          },
          authToken
        );
      }

      toast.success(message);
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update your profile."));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">My profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your personal details and account security.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="h-fit rounded-lg bg-card p-5 ring-1 ring-black/8">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-20 rounded-full" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                {image ? (
                  <Image
                    src={imgUrl(image)}
                    alt=""
                    width={80}
                    height={80}
                    unoptimized
                    className="size-20 rounded-full object-cover ring-1 ring-black/10"
                  />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-brand text-xl font-semibold text-brand-foreground">
                    {initials(fullName || profile?.full_name)}
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold">
                    {profile?.full_name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.email}
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck />
                  {profile?.role_label || humanize(profile?.role) || "Staff"}
                </Badge>
              </div>

              <div className="mt-5 flex flex-col gap-3.5 border-t pt-5">
                <Fact icon={Mail} label="Email" value={profile?.email} />
                <Fact icon={Phone} label="Phone" value={profile?.phone} />
                {profile?.branch?.name && (
                  <Fact
                    icon={Building2}
                    label="Branch"
                    value={profile.branch.name}
                  />
                )}
                <Fact
                  icon={CalendarDays}
                  label="Member since"
                  value={formatDate(profile?.created_at)}
                />
                <Fact
                  icon={BadgeCheck}
                  label="Last active"
                  value={formatDate(profile?.last_activity_at)}
                />
              </div>
            </>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <SectionCard
              title="Profile details"
              description="This is how your name appears across the admin."
              footer={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void load()}
                    disabled={isSubmitting || loading || !isDirty}
                  >
                    Discard
                  </Button>
                  <Button type="submit" disabled={isSubmitting || loading || !isDirty}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {isSubmitting ? "Saving…" : "Save changes"}
                  </Button>
                </>
              }
            >
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-24 sm:col-span-2" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. Ammar Ali"
                      autoComplete="name"
                      aria-invalid={!!errors.full_name}
                      {...register("full_name")}
                    />
                    {errors.full_name && (
                      <p className="text-sm text-destructive">
                        {errors.full_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="e.g. +1 555 000 1234"
                      autoComplete="tel"
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                    {errors.phone ? (
                      <p className="text-sm text-destructive">
                        {errors.phone.message}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Used for order and shift notifications.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Profile photo</Label>
                    <MediaUpload
                      value={image}
                      folder="avatars"
                      onChange={(url) =>
                        setValue("image", url, { shouldDirty: true })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Square images look best. PNG or JPG.
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      value={profile?.email ?? ""}
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Your email is your sign-in ID and can only be changed by an
                      administrator.
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>
          </form>

          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
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

  const fields = [
    {
      name: "currentPassword" as const,
      label: "Current password",
      placeholder: "Enter current password",
      autoComplete: "current-password",
      show: showCurrent,
      toggle: () => setShowCurrent((v) => !v),
    },
    {
      name: "newPassword" as const,
      label: "New password",
      placeholder: "At least 8 characters",
      autoComplete: "new-password",
      show: showNew,
      toggle: () => setShowNew((v) => !v),
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <SectionCard
        title="Password"
        description="Use a strong password you don't reuse anywhere else."
        footer={
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        }
      >
        <div className="grid max-w-lg gap-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name}>
                {field.label} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id={field.name}
                  type={field.show ? "text" : "password"}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  className="pr-10"
                  aria-invalid={!!errors[field.name]}
                  {...register(field.name)}
                />
                <button
                  type="button"
                  onClick={field.toggle}
                  aria-label={field.show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {field.show ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors[field.name] && (
                <p className="text-sm text-destructive">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">
              Confirm new password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter new password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      </SectionCard>
    </form>
  );
}
