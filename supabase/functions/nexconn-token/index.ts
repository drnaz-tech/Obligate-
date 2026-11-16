import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sign(secret: string, nonce: string, timestamp: string) {
  const data = new TextEncoder().encode(`${secret}${nonce}${timestamp}`);
  return hex(await crypto.subtle.digest("SHA-1", data));
}

// Nexconn user IDs accept letters and digits only, so UUIDs are compacted.
const toNexconnId = (uuid: string) => uuid.replace(/-/g, "").toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const appKey = Deno.env.get("NEXCONN_APP_KEY");
  const appSecret = Deno.env.get("NEXCONN_APP_SECRET");
  const apiBase = Deno.env.get("NEXCONN_API_BASE") ?? "https://api.sg-light-api.com";
  if (!appKey || !appSecret) return json({ error: "NEXCONN_NOT_CONFIGURED" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: "AUTH_REQUIRED" }, 401);

  let roomId: string | undefined;
  try {
    const body = await req.json();
    roomId = body?.roomId;
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!roomId) return json({ error: "ROOM_REQUIRED" }, 400);

  // Membership is checked with the caller's own JWT, so RLS and the
  // is_room_member helper decide access — never the client.
  const { data: member, error: memberError } = await supabase.rpc("is_room_member", {
    p_room_id: roomId,
  });
  if (memberError) return json({ error: "MEMBERSHIP_CHECK_FAILED" }, 500);
  if (!member) return json({ error: "NOT_A_MEMBER" }, 403);

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, host_id, guest_id, status")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  const uid = userData.user.id;
  const peerId = room.host_id === uid ? room.guest_id : room.host_id;
  if (!peerId) return json({ error: "PARTNER_NOT_JOINED" }, 409);

  const { data: profile } = await supabase
    .from("profiles")
    .select("detective_name")
    .eq("id", uid)
    .maybeSingle();

  const nonce = String(Math.floor(Math.random() * 1e9));
  const timestamp = String(Date.now());
  const signature = await sign(appSecret, nonce, timestamp);

  const upstream = await fetch(`${apiBase}/v4/auth/access-token/issue`, {
    method: "POST",
    headers: {
      "App-Key": appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: signature,
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID().replace(/-/g, ""),
    },
    body: JSON.stringify({
      userId: toNexconnId(uid),
      name: profile?.detective_name ?? "Detective",
    }),
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload || payload.code !== 0) {
    return json(
      { error: "TOKEN_ISSUE_FAILED", detail: payload?.errorMessage ?? upstream.status },
      502,
    );
  }

  return json({
    appKey,
    userId: toNexconnId(uid),
    peerId: toNexconnId(peerId),
    token: payload.result.accessToken,
    roomId,
  });
});
