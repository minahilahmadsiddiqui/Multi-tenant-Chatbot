import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/layout/BackButton";
import { cn } from "@/lib/utils";

interface AppTopBarProps {
  onBack?: () => void;
  backLabel?: string;
  backShortLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
  isLoggingOut?: boolean;
  className?: string;
  dark?: boolean;
  inverted?: boolean;
}

export function AppTopBar({
  onBack,
  backLabel = "Back",
  backShortLabel,
  onLogout,
  logoutLabel = "Logout",
  isLoggingOut = false,
  className,
  dark = false,
  inverted = false,
}: AppTopBarProps) {
  const isLightOnDark = inverted || dark;
  const backVariant = isLightOnDark ? "inverted" : "default";

  const hasBack = Boolean(onBack);
  const hasLogout = Boolean(onLogout);

  if (!hasBack && !hasLogout) return null;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3",
        hasBack && hasLogout ? "justify-between" : hasLogout ? "justify-end" : "justify-start",
        className
      )}
    >
      {onBack && (
        <BackButton
          onClick={onBack}
          label={backLabel}
          shortLabel={backShortLabel}
          variant={backVariant}
        />
      )}

      {onLogout && (
        <Button
          variant={isLightOnDark ? "hero-outline" : dark ? "outline" : "secondary"}
          onClick={onLogout}
          disabled={isLoggingOut}
          className={cn(
            "shrink-0 rounded-full px-5 shadow-sm",
            dark && !inverted && "border-white/25 bg-white/10 text-slate-100 hover:bg-white/20 hover:text-white"
          )}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Logging out..." : logoutLabel}
        </Button>
      )}
    </div>
  );
}
