export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "blockworld-realtime" });
    }
    if (url.pathname !== "/ws" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("BlockWorld Realtime Worker", { status: 200 });
    }

    const room = (url.searchParams.get("room") || "").slice(0, 64);
    const token = url.searchParams.get("token") || "";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(room) || !token) {
      return new Response("Invalid room or missing token", { status: 400 });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return new Response("Supabase auth secrets are not configured", { status: 503 });
    }

    let user;
    try {
      const authRes = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      });
      if (!authRes.ok) return new Response("Unauthorized", { status: 401 });
      user = await authRes.json();
      if (!user?.id) return new Response("Unauthorized", { status: 401 });
    } catch {
      return new Response("Authentication service unavailable", { status: 502 });
    }

    let isAdmin = false;
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminRes = await fetch(
          `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/speed_game_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
          { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
        );
        if (adminRes.ok) isAdmin = (await adminRes.json()).length > 0;
      } catch {
        isAdmin = false;
      }
    }

    const id = (url.searchParams.get("id") || crypto.randomUUID()).slice(0, 64);
    const name = (url.searchParams.get("name") || "플레이어").slice(0, 24);
    const game = (url.searchParams.get("game") || "").slice(0, 24);
    const namespaceId = env.ROOMS.idFromName(`room:${room}`);
    const stub = env.ROOMS.get(namespaceId);
    const headers = new Headers(request.headers);
    headers.set("X-BW-User-Id", user.id);
    headers.set("X-BW-Player-Id", id);
    headers.set("X-BW-Player-Name", name);
    headers.set("X-BW-Game", game);
    headers.set("X-BW-Is-Admin", isAdmin ? "1" : "0");
    headers.set("X-BW-Room", room);
    return stub.fetch(new Request(request, { headers }));
  }
};

export class RoomHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const meta = {
      userId: request.headers.get("X-BW-User-Id") || "",
      id: request.headers.get("X-BW-Player-Id") || crypto.randomUUID(),
      name: request.headers.get("X-BW-Player-Name") || "플레이어",
      game: request.headers.get("X-BW-Game") || "",
      isAdmin: request.headers.get("X-BW-Is-Admin") === "1",
      room: request.headers.get("X-BW-Room") || ""
    };
    if (!meta.userId || !meta.room) return new Response("Unauthorized", { status: 401 });

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ ...meta, lastPositionAt: 0 });
    server.send(JSON.stringify({ type: "presence", event: "sync", state: this.presenceState() }));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  presenceState() {
    const state = {};
    for (const ws of this.state.getWebSockets()) {
      try {
        const p = ws.deserializeAttachment();
        if (p?.id) state[p.id] = [{ id: p.id, userId: p.userId, name: p.name, game: p.game || "" }];
      } catch {}
    }
    return state;
  }

  broadcastPresence() {
    const message = JSON.stringify({ type: "presence", event: "sync", state: this.presenceState() });
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(message); } catch {}
    }
  }

  broadcast(event, payload) {
    const message = JSON.stringify({ type: "broadcast", event, payload });
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(message); } catch {}
    }
  }

  webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const meta = ws.deserializeAttachment();
    if (!meta || !msg || typeof msg !== "object") return;

    if (msg.type === "track") {
      const p = msg.payload || {};
      ws.serializeAttachment({
        ...meta,
        name: String(p.name || meta.name).slice(0, 24),
        game: String(p.game || "").slice(0, 24),
        id: meta.id,
        userId: meta.userId
      });
      this.broadcastPresence();
      return;
    }

    if (msg.type !== "broadcast") return;
    const event = String(msg.event || "");
    const allowed = new Set(["chat", "game", "position", "anticheat", "admin-abuse", "server-msg", "command"]);
    if (!allowed.has(event)) return;

    const isGlobal = meta.room === "__GLOBAL__";
    if (["admin-abuse", "server-msg"].includes(event) && (!isGlobal || !meta.isAdmin)) {
      ws.send(JSON.stringify({ type: "error", message: "관리자 권한이 필요합니다." }));
      return;
    }
    if (event === "command" && !meta.isAdmin) {
      ws.send(JSON.stringify({ type: "error", message: "관리자 권한이 필요합니다." }));
      return;
    }

    let payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    if (JSON.stringify(payload).length > 12000) return;

    if (event === "position") {
      const now = Date.now();
      if (now - (meta.lastPositionAt || 0) < 140) return;
      meta.lastPositionAt = now;
      ws.serializeAttachment(meta);
      payload = {
        id: meta.id, userId: meta.userId, name: meta.name,
        game: String(payload.game || "").slice(0, 24),
        x: Number(payload.x) || 0, y: Number(payload.y) || 0,
        z: Number(payload.z) || 0, rotation: Number(payload.rotation) || 0
      };
    } else if (event === "chat") {
      payload = { name: meta.name, message: String(payload.message || "").slice(0, 100) };
      if (!payload.message) return;
    } else if (event === "game") {
      payload = { id: meta.id, name: meta.name, game: String(payload.game || "").slice(0, 24) };
    } else if (event === "anticheat") {
      payload = { name: meta.name, reason: String(payload.reason || "").slice(0, 40) };
    }

    this.broadcast(event, payload);
  }

  webSocketClose() { this.broadcastPresence(); }
  webSocketError() { this.broadcastPresence(); }
}
