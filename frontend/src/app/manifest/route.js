export async function GET(request) {
  const requestUrl = new URL(request.url);
  const rawToken = requestUrl.searchParams.get("token") || "";
  const token = rawToken.replace(/[^a-zA-Z0-9_-]/g, "");

  const startUrl = token ? `/app/${token}` : "/";
  const scope = token ? `/app/${token}` : "/";

  const manifest = {
    id: startUrl,
    name: "Smart Assistance",
    short_name: "Smart Assist",
    description: "Assistenza, garanzia e accessori consigliati per il tuo smartphone.",
    start_url: startUrl,
    scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    categories: ["shopping", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
