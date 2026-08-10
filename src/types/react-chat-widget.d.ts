declare module "react-chat-widget" {
  import type { ComponentType, ReactNode } from "react";

  export interface WidgetProps {
    handleNewUserMessage: (message: string) => void;
    title?: string;
    subtitle?: string;
    senderPlaceHolder?: string;
    profileAvatar?: string;
    profileClientAvatar?: string;
    titleAvatar?: string;
    showCloseButton?: boolean;
    fullScreenMode?: boolean;
    autofocus?: boolean;
    handleToggle?: (opened: boolean) => void;
    handleQuickButtonClicked?: (e: unknown, value: string | number) => void;
    chatId?: string;
    launcherOpenLabel?: string;
    launcherCloseLabel?: string;
    launcherCloseImg?: string;
    launcherOpenImg?: string;
    sendButtonAlt?: string;
    showTimeStamp?: boolean;
    showBadge?: boolean;
    emojis?: boolean;
    resizable?: boolean;
    launcher?: (toggle: () => void) => ReactNode;
  }

  export const Widget: ComponentType<WidgetProps>;

  export function addUserMessage(text: string, id?: string): void;
  export function addResponseMessage(text: string, id?: string): void;
  export function toggleMsgLoader(): void;
  export function toggleWidget(): void;
  export function markAllAsRead(): void;
  export function setBadgeCount(count: number): void;
  export function dropMessages(): void;
}
