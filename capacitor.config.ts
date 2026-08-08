import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aarushfire.billing",
  appName: "Aarush Fire Protection",
  webDir: "public",
  server: {
    // Points at the Next.js dev server running on this laptop. With the phone tethered
    // over USB and `adb reverse tcp:3000 tcp:3000` set up, the device's own localhost:3000
    // is forwarded to the laptop's -- no shared WiFi network required.
    url: "http://localhost:3000",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
