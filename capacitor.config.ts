import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.podmei.app",
  appName: "PODMEI",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    // Mercado Pago stays out of the iOS WebView (Guideline 3.1.1 — no external IAP path in-app).
    allowNavigation: ["podmei.com", "www.podmei.com"],
  },
  ios: {
    contentInset: "automatic",
    scheme: "PODMEI",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#7B2CF5",
    },
  },
};

export default config;
