import { getDictionary } from "@/lib/i18n";

export default function Home() {
  const dict = getDictionary("az");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div>
        <h1>{dict.home.title}</h1>
        <p style={{ color: "var(--muted)" }}>{dict.home.subtitle}</p>
      </div>
    </main>
  );
}
