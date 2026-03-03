import Link from "next/link";

/**
 * 홈: 발표용 투표 앱 진입점. 실제 사용 시 sid는 발표 세션별로 생성해 공유.
 */
export default function HomePage() {
  const sid = "test1";
  return (
    <main style={{ padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>발표용 투표</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        세션 ID(sid)를 공유한 뒤 아래 링크로 접속하세요.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li style={{ marginBottom: "0.75rem" }}>
          <Link href={`/v?sid=${sid}`}>투표 페이지 (관객)</Link>
        </li>
        <li style={{ marginBottom: "0.75rem" }}>
          <Link href={`/screen?sid=${sid}`}>스크린 집계</Link>
        </li>
      </ul>
      <p style={{ fontSize: "0.9rem", color: "#999", marginTop: "1.5rem" }}>
        예: /v?sid=test1 , /screen?sid=test1
      </p>
    </main>
  );
}
