declare module 'playwright' {
  export interface LaunchOptions {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
    proxy?: { server: string };
    timeout?: number;
    locale?: string;
    userAgent?: string;
    viewport?: { width: number; height: number };
  }

  export interface BrowserType {
    launch(options?: LaunchOptions): Promise<unknown>;
  }

  export const chromium: BrowserType;
  export const firefox: BrowserType;
  export const webkit: BrowserType;
}
