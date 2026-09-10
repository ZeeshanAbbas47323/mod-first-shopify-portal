import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center">
          {/* The dark-ink mark disappears on a dark ground, so each theme gets
              its own file. Swapped with CSS rather than the resolved theme, so
              there is no post-hydration flash. */}
          <Image
            src="/images/branding/logo-dark.svg"
            alt="ModFirst"
            width={190}
            height={40}
            priority
            className="dark:hidden"
          />
          <Image
            src="/images/branding/logo_white.png"
            alt=""
            aria-hidden="true"
            width={190}
            height={40}
            priority
            className="hidden dark:block"
          />
        </div>
        <Card>
          <CardContent className="p-8">
            {title && (
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
            )}
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
