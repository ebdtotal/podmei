import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.podmei.app",
  appName: "PODMEI",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: ["podmei.com", "www.podmei.com", "www.mercadopago.com.br", "*.mercadopago.com"],
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
