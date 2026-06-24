// Public QR PNG generator. /api/cards/qr?url=...&size=512&fg=%23000&bg=%23fff
import QRCode from "qrcode";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url");
  if (!url) return new Response("url is required", { status: 400 });

  const size = Math.min(Math.max(Number(params.get("size") || "512"), 64), 1024);
  const fg = params.get("fg") || "#0f1c14";
  const bg = params.get("bg") || "#ffffff";

  try {
    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      width: size,
      margin: 1,
      color: { dark: fg, light: bg },
      errorCorrectionLevel: "M",
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Could not generate QR", { status: 500 });
  }
}
