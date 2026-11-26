"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({
  children,
  ...props
}: {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
} & Record<string, unknown>) {
  return (
    <NextThemesProvider
      attribute={props.attribute as "class"}
      defaultTheme={props.defaultTheme as string}
      enableSystem={Boolean(props.enableSystem)}
      disableTransitionOnChange={Boolean(props.disableTransitionOnChange)}
    >
      {children}
    </NextThemesProvider>
  );
}
