import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import QRCode from "qrcode";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/lobby");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  let qrSvg: string | null = null;
  if (appUrl) {
    try {
      qrSvg = await QRCode.toString(appUrl, {
        type: "svg",
        margin: 1,
        color: { dark: "#1a0f5e", light: "#ffe94a" },
      });
    } catch {
      // ignore — QR is optional
    }
  }

  return <LoginForm qrSvg={qrSvg} appUrl={appUrl ?? null} />;
}
