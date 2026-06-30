export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";
  const startUrl = token ? `/app/${encodeURIComponent(token)}` : "/";

  const manifest = {
    name: "Smart Assistance",
    short_name: "Smart",
    description: "Assistenza, garanzia, offerte e supporto per smartphone, notebook e PC.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f8fbff",
    theme_color: "#0f172a",
    orientation: "any",
    categories: ["shopping", "utilities", "productivity"],
    icons: [
      {
        src: "/icons/sa-icon-192.png?v=39",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/sa-icon-512.png?v=39",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/sa-maskable-192.png?v=39",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/sa-maskable-512.png?v=39",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/apple-touch-icon.png?v=39",
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ],
    shortcuts: [
      {
        name: "Offerte per te",
        short_name: "Offerte",
        description: "Apri la sezione offerte consigliate.",
        url: startUrl,
        icons: [
          {
            src: "/icons/sa-icon-192.png?v=39",
            sizes: "192x192",
            type: "image/png"
          }
        ]
      }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
