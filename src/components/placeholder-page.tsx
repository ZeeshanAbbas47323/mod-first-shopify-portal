import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  cta,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Icon className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm font-semibold">{title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
          <Button className="mt-2">
            {cta}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
