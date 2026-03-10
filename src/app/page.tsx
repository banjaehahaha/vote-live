import Link from "next/link";

/**
 * 홈: 발표용 투표 앱 진입점. 실제 사용 시 sid는 발표 세션별로 생성해 공유.
 */
export default function HomePage() {
  const sid = "test-0311";
  return (
    <main style={{ padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>MMCA 레지던시의 날</h1>
      <h1 style={{ marginBottom: "1rem" }}>MMCA Residency Day</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        2026.03.13. 10:30-18:00
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li style={{ marginBottom: "0.75rem" }}>
          <Link href={`/v?sid=${sid}`}>반재하</Link>
        </li>
        <li style={{ marginBottom: "0.75rem" }}>
          <Link href={`/screen?sid=${sid}`}>Jaeha Ban</Link>
        </li>
      </ul>
    </main>
  );
}
