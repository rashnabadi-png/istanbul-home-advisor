// Public settings shown in the chat. Set them as environment variables in Vercel.
export function config() {
  return {
    brand: process.env.BRAND_NAME || "Istanbul Home Advisor",
    whatsapp: process.env.WHATSAPP_NUMBER || "",
    dataCheckedOn: process.env.DATA_CHECKED_ON || new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}
