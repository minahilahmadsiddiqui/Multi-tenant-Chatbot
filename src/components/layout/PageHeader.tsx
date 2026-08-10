import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBadge } from "@/components/layout/IconBadge";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function PageHeader({ icon, title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex items-start gap-4 sm:gap-5", className)}>
      <IconBadge icon={icon} variant="navy" size="lg" className="shadow-[var(--shadow-glow-navy)]" />
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
      </div>
    </div>
  );
}
