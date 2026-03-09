import { NextRequest, NextResponse } from "next/server";
import { isValidSid } from "@/lib/validation";
// @ts-expect-error no types
import QRCode from "qrcode";

export const runtime = "nodejs";

/**
 * GET /api/presentation/qr?sid=xxx
 * 투표 URL(/v?sid=xxx)용 QR 코드 PNG 반환.
 * 발표 vote stage에서 동적 QR 표시용.
 */
export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get("sid");
  if (!isValidSid(sid)) {
    return NextResponse.json({ error: "Invalid or missing sid" }, { status: 400 });
  }
  const origin = request.nextUrl.origin;
  const voteUrl = `${origin}/v?sid=${encodeURIComponent(sid)}`;
  try {
    const dataUrl = await QRCode.toDataURL(voteUrl, { width: 400, margin: 2 });
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/presentation/qr]", err);
    return NextResponse.json({ error: "QR generation failed" }, { status: 500 });
  }
}
