// Public settings shown in the chat. Set them as environment variables in Vercel.
export function config() {
  return {
    brand: process.env.BRAND_NAME || "Istanbul Home Advisor",
    whatsapp: process.env.WHATSAPP_NUMBER || "",
    // Esri (ArcGIS Location Platform) API key for the satellite map. It is a browser key: restrict it to your domain in the Esri dashboard.
    // Google OAuth web client ID for "Sign in with Google". When set, visitors sign in before the advisor shows matches.
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    esriKey: process.env.ESRI_API_KEY || "",
    ai: !!process.env.ANTHROPIC_API_KEY, // false = answer typed messages from our own data only (no AI cost)
    dataCheckedOn: process.env.DATA_CHECKED_ON || new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}
