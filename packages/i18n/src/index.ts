import type enMessages from "../messages/en/common.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: import("./config").Locale;
    Messages: typeof enMessages;
  }
}

export * from "./config";
export * from "./formats";
export * from "./getMessages";
export * from "./provider";
