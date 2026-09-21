import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import AppProvider from "./AppProvider.tsx";
import acceleratorTheme from "./theme/theme.ts";
import defaultFaviconUrl from "./assets/DEFAULT_FAVICON.svg";

// This runs in Vite's module graph so both the environment value and fallback
// asset URL are transformed for production (including non-root deployments).
const faviconUrl = import.meta.env.VITE_APP_FAVICON || defaultFaviconUrl;
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.href = faviconUrl;
favicon.type = faviconUrl.endsWith(".ico") ? "image/x-icon" : "image/svg+xml";
document.head.appendChild(favicon);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={acceleratorTheme} toastOptions={{defaultOptions: {position:"bottom-right", variant: "subtle"}}}>
      <AppProvider />
    </ChakraProvider>
  </React.StrictMode>
);
