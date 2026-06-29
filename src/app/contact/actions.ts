"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const DEST_EMAIL = process.env.CONTACT_EMAIL!;
const RATE_LIMIT_MINUTES = 10;

export type ContactState = { error?: string; success?: boolean } | null;

export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot — les bots remplissent ce champ caché, les humains non
  if (formData.get("website")) return { success: true };

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!name || name.length < 2) return { error: "Nom trop court" };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email invalide" };
  if (!message || message.length < 10) return { error: "Message trop court (min 10 caractères)" };
  if (message.length > 2000) return { error: "Message trop long (max 2000 caractères)" };

  const supabase = await createClient();

  // Rate limiting par email — 1 message toutes les RATE_LIMIT_MINUTES minutes
  const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("contact_logs")
    .select("id")
    .eq("email", email)
    .gte("created_at", since)
    .maybeSingle();

  if (recent) {
    return { error: `Tu as déjà envoyé un message récemment. Réessaie dans ${RATE_LIMIT_MINUTES} minutes.` };
  }

  const { error: sendError } = await resend.emails.send({
    from: "RivalRush <onboarding@resend.dev>",
    to: DEST_EMAIL,
    replyTo: email,
    subject: `[Contact RR] ${subject || "Nouveau message"} — ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#1A0F5E;color:#fff;border-radius:12px">
        <h2 style="color:#00D4E8;margin:0 0 24px">Nouveau message — RivalRush</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px;width:100px">Nom</td><td style="padding:8px 0;font-weight:700">${name}</td></tr>
          <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Email</td><td style="padding:8px 0;font-weight:700"><a href="mailto:${email}" style="color:#00D4E8">${email}</a></td></tr>
          ${subject ? `<tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Sujet</td><td style="padding:8px 0;font-weight:700">${subject}</td></tr>` : ""}
        </table>
        <div style="margin-top:24px;padding:20px;background:rgba(255,255,255,0.07);border-radius:8px;border-left:4px solid #FF1E8C">
          <p style="margin:0;line-height:1.7;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
        <p style="margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)">Envoyé depuis le formulaire de contact RivalRush</p>
      </div>
    `,
  });

  if (sendError) {
    console.error("Resend error:", sendError);
    return { error: "Erreur lors de l'envoi. Réessaie plus tard." };
  }

  await Promise.all([
    supabase.from("contact_logs").insert({ email }),
    supabase.from("contacts").insert({ name, email, subject: subject || null, message }),
  ]);

  return { success: true };
}
