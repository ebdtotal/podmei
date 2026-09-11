import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
import { StoreProvider } from "./lib/store";
import { ThemeProvider } from "./lib/theme";
import { AlertBridge } from "./lib/AlertBridge";
import { WorkspaceCloudBridge } from "./lib/WorkspaceCloudBridge";
import { iniciarAppNativo } from "./lib/native";
import "./index.css";

void iniciarAppNativo();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <StoreProvider>
              <WorkspaceCloudBridge />
              <AlertBridge />
              <App />
            </StoreProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
