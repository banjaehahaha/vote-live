#!/usr/bin/env node
/**
 * QR 코드 생성 스크립트 (제한/광고 없음, 로컬에서 이미지 파일로 저장)
 * 사용: node scripts/generate-qr.mjs [URL]
 * 기본 URL: https://vote.banjaeha.com
 */
import QRCode from "qrcode";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://vote.banjaeha.com";
const outPath = join(__dirname, "..", "public", "vote-qr.png");

QRCode.toFile(outPath, url, { width: 400, margin: 2 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("QR 코드 생성됨:", outPath);
  console.log("연결 URL:", url);
});
