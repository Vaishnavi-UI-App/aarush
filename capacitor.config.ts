import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aarushfire.billing",
  appName: "Aarush Fire Protection",
  webDir: "public",
  server: {
    // Points at the production deployment -- no cable, ADB, or shared WiFi needed;
    // the app works over the internet like any other native app.
    url: "https://aarushfireprotechtion.in",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
