import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "./AdminShell";
import { AdminLoginPage } from "./AdminLoginPage";
import type { Contact } from "./ContactsClient";
import type { Report } from "./ReportsClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <AdminLoginPage />;
  }

  const userIsAdmin = await isAdmin();
  if (!userIsAdmin) {
    redirect("/lobby");
  }

  // Bootstrap app_metadata si pas encore défini (admin existant)
  // Nécessaire pour que le middleware puisse bypasser la maintenance
  const db = createAdminClient();
  if (!user.app_metadata?.is_admin) {
    await db.auth.admin.updateUserById(user.id, {
      app_metadata: { is_admin: true },
    });
  }

  const [
    { data: allPlayers },
    { data: lbRows },
    { data: contactRows },
    { data: reportRows },
    { data: adminRows },
  ] = await Promise.all([
    db.from("players")
      .select("id, pseudo, avatar_url, created_at")
      .order("pseudo", { ascending: true }),
    db.from("leaderboard").select("player_id, wins, losses, draws, points"),
    db.from("contacts").select("*").order("created_at", { ascending: false }),
    db.from("reports").select("*").order("created_at", { ascending: false }),
    db.from("admins").select("player_id"),
  ]);

  const lbMap = new Map((lbRows ?? []).map((r) => [r.player_id, r]));
  const players = (allPlayers ?? []).map((p) => {
    const lb = lbMap.get(p.id);
    return {
      id: p.id,
      pseudo: p.pseudo,
      avatar_url: (p.avatar_url as string | null) ?? null,
      wins: lb?.wins ?? 0,
      losses: lb?.losses ?? 0,
      draws: lb?.draws ?? 0,
      points: lb?.points ?? 0,
      neverPlayed: !lb,
    };
  });

  const playerMap = new Map(
    (allPlayers ?? []).map((p) => [p.id, p.pseudo as string]),
  );
  const reports: Report[] = (reportRows ?? []).map((r) => ({
    id: r.id as string,
    reporter_id: r.reporter_id as string,
    reporter_pseudo: playerMap.get(r.reporter_id as string) ?? "?",
    reported_player_id: r.reported_player_id as string,
    reported_pseudo: playerMap.get(r.reported_player_id as string) ?? "?",
    game_id: (r.game_id as string | null) ?? null,
    message_content: r.message_content as string,
    status: r.status as Report["status"],
    created_at: r.created_at as string,
  }));

  const adminPlayerIds = (adminRows ?? []).map((r) => r.player_id as string);
  const superAdminId = process.env.SUPER_ADMIN_ID ?? null;

  return (
    <AdminShell
      players={players}
      contacts={(contactRows ?? []) as Contact[]}
      reports={reports}
      adminPlayerIds={adminPlayerIds}
      superAdminId={superAdminId}
    />
  );
}
