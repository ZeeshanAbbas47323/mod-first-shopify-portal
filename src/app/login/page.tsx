"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage, login as loginRequest } from "@/lib/auth-api";
import { loginSchema, type LoginValues } from "@/lib/validations";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const onSubmit = async (values: LoginValues) => {
    try {
      const result = await loginRequest({ ...values, rememberMe: true });

      if (result.token) {
        login(
          result.user ?? {
            name: values.email.split("@")[0],
            email: values.email,
          },
          result.token,
          result.refreshToken
        );
        toast.success(result.message || "Welcome back!");
        router.replace("/");
        return;
      }

      // No token in the response → backend has already emailed an OTP on login.
      toast.info(result.message || "Enter the code we emailed you.");
      router.push(`/login/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Login failed. Check your credentials."));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex items-center justify-center rounded-xl bg-[#1a1a1a] px-5 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/branding/logo_white.png"
              alt="Mod First"
              className="h-8 w-auto"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-8">
            <h1 className="text-xl font-semibold text-foreground">Log in</h1>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Continue to modeFirst Portal
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@store.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/login/forgot-password"
                    className="text-sm font-medium text-[#005bd3] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pr-10"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? "Logging in…" : "Log in"}
              </Button>
            </form>

          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Help · Privacy · Terms
        </p>
      </div>
    </div>
  );
}
