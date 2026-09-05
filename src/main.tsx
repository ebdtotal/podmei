import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
import { StoreProvider } from "./lib/store";
import { ThemeProvider } from "./lib/theme";
import { WorkspaceCloudBridge } from "./lib/WorkspaceCloudBridge";
import { iniciarAppNativo } from "./lib/native";
import "./index.css";

void iniciarAppNativo();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <StoreProvider>
              <WorkspaceCloudBridge />
              <App />
            </StoreProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
