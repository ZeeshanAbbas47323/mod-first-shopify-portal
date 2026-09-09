import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  /** Screen heading, e.g. "Log in". */
  title?: string;
  /** Supporting line under the heading. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The frame every auth screen sits in — logo, card and footer. Login, OTP and
 * password reset all render through this so the three screens stay identical;
 * they previously duplicated the markup and had drifted apart on the logo and
 * heading alignment.
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center">
          <Image
            src="/images/branding/logo-dark.svg"
            alt="ModFirst"
            width={190}
            height={40}
            priority
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
