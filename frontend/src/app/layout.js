export const metadata = {
  title: "Smart Assistance",
  description: "CRM Smartphone",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body data-sa-bg-fix="PATCH_63_2_LAYOUT_BODY_BG" style={{ backgroundColor: "#0b1220", margin: 0 }}>{children}</body>
    </html>
  );
}