import {
  AppWindow,
  Bot,
  ClipboardCopy,
  Globe,
  Maximize,
  PlayCircle,
  RotateCcw,
  SquareArrowOutUpRight,
  Smartphone,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MonitoringEventType, MonitoringSeverity, MonitoringSignalStatus } from "./types";

export const eventSeverity: Record<MonitoringEventType, MonitoringSeverity> = {
  "session-started": "info",
  "student-present": "info",
  "focus-resumed": "info",
  "focus-maintained": "info",
  "tab-switch": "notice",
  "window-blur": "notice",
  "copy-paste": "notice",
  "fullscreen-exit": "notice",
  "phone-detected": "warning",
  "student-absent": "warning",
  "multiple-persons": "warning",
  "external-resource": "warning",
  "ai-resource": "warning",
};

export const eventStatus: Record<MonitoringEventType, MonitoringSignalStatus> = {
  "session-started": "real",
  "student-present": "camera",
  "focus-resumed": "real",
  "focus-maintained": "real",
  "tab-switch": "real",
  "window-blur": "real",
  "copy-paste": "real",
  "fullscreen-exit": "real",
  "phone-detected": "camera",
  "student-absent": "camera",
  "multiple-persons": "camera",
  "external-resource": "future",
  "ai-resource": "future",
};

export const eventIcon: Record<MonitoringEventType, LucideIcon> = {
  "session-started": PlayCircle,
  "student-present": UserCheck,
  "focus-resumed": RotateCcw,
  "focus-maintained": UserCheck,
  "tab-switch": SquareArrowOutUpRight,
  "window-blur": AppWindow,
  "copy-paste": ClipboardCopy,
  "fullscreen-exit": Maximize,
  "phone-detected": Smartphone,
  "student-absent": UserX,
  "multiple-persons": Users,
  "external-resource": Globe,
  "ai-resource": Bot,
};
