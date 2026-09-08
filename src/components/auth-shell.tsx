import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

export function AuthShell({ children }: { children: React.ReactNode }) {
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
          <CardContent className="p-8">{children}</CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Help · Privacy · Terms
        </p>
      </div>
    </div>
  );
}
