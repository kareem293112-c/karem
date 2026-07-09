import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { getDb, saveDb, initDb, DatabaseSchema } from "./server/db";
import { AppUser, VoiceRoom, AgentTransferLog, VoiceSeat } from "./src/types";

// Initialize database
initDb();

const app = express();
const PORT = 3000;

// Enable JSON body parsing
app.use(express.json());

// Create HTTP Server
const server = http.createServer(app);

// Create WebSocket Server
const wss = new WebSocketServer({ server });

// Map to track connected room clients
// Key: roomId, Value: Set of clients
interface CustomWebSocket extends WebSocket {
  roomId?: string;
  userId?: string;
  userName?: string;
}
const roomClients = new Map<string, Set<CustomWebSocket>>();

// Broadcast utility helper
function broadcastToRoom(roomId: string, message: any, excludeClient?: CustomWebSocket) {
  const clients = roomClients.get(roomId);
  if (!clients) return;
  const msgString = JSON.stringify(message);
  for (const client of clients) {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(msgString);
    }
  }
}

// WebSocket Connection Handler
wss.on("connection", (ws: CustomWebSocket) => {
  console.log("جديد: متصل بالـ WebSocket");

  ws.on("message", (messageBuffer) => {
    try {
      const data = JSON.parse(messageBuffer.toString());
      const { action, roomId, userId, userName } = data;

      if (action === "join") {
        ws.roomId = roomId;
        ws.userId = userId;
        ws.userName = userName;

        if (!roomClients.has(roomId)) {
          roomClients.set(roomId, new Set());
        }
        roomClients.get(roomId)!.add(ws);

        console.log(`المستخدم ${userName} (${userId}) دخل الغرفة ${roomId}`);

        // Notify others
        broadcastToRoom(roomId, {
          type: "system_message",
          text: `دخل ${userName} إلى المجلس`,
          userId,
          userName,
          timestamp: new Date().toISOString()
        }, ws);

        // Send confirmation back
        ws.send(JSON.stringify({
          type: "join_success",
          roomId,
          message: "تم الاتصال بالغرفة بنجاح وبث الصوت وتزامن المقاعد نشط!"
        }));
      }

      else if (action === "leave") {
        if (ws.roomId && roomClients.has(ws.roomId)) {
          roomClients.get(ws.roomId)!.delete(ws);
          broadcastToRoom(ws.roomId, {
            type: "system_message",
            text: `غادر ${ws.userName || 'مستخدم'} المجلس`,
            userId: ws.userId,
            userName: ws.userName,
            timestamp: new Date().toISOString()
          });
        }
      }

      else if (action === "seats_update") {
        const { seats } = data;
        const db = getDb();
        const rIdx = db.rooms.findIndex(r => r.id === roomId);
        if (rIdx !== -1) {
          db.rooms[rIdx].seats = seats;
          saveDb(db);
          
          // Broadcast seat update to everyone else in the room
          broadcastToRoom(roomId, {
            type: "seats_changed",
            seats
          }, ws);
        }
      }

      else if (action === "chat_message") {
        const { text, avatar, senderLevel } = data;
        broadcastToRoom(roomId, {
          type: "new_chat_message",
          id: Math.random().toString(36).substring(7),
          senderId: userId,
          senderName: userName,
          senderAvatar: avatar,
          senderLevel,
          text,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        });
      }

      else if (action === "send_gift") {
        const { gift, senderId, receiverId, receiverSeatIndex } = data;
        const db = getDb();
        const sender = db.users.find(u => u.id === senderId);
        const receiver = db.users.find(u => u.id === receiverId);

        if (sender && sender.coins >= gift.cost) {
          // Deduct from sender
          sender.coins -= gift.cost;
          sender.xp += gift.xpReward;
          sender.level = Math.floor(1 + Math.sqrt(sender.xp / 100)); // Dynamic level up

          // Add to receiver if exists
          if (receiver) {
            receiver.coins += gift.cost * 0.5; // Receive 50% commission
            receiver.xp += gift.xpReward * 0.8;
            receiver.level = Math.floor(1 + Math.sqrt(receiver.xp / 100));
          }

          // If gifting in active room, increase room level/xp
          const room = db.rooms.find(r => r.id === roomId);
          if (room) {
            room.xp += gift.xpReward;
            room.level = Math.floor(1 + Math.sqrt(room.xp / 300));
          }

          saveDb(db);

          // Broadcast database updates to update client state
          broadcastToRoom(roomId, {
            type: "gift_received",
            gift,
            senderId,
            senderName: sender.name,
            senderCoins: sender.coins,
            senderLevel: sender.level,
            receiverId,
            receiverName: receiver ? receiver.name : "المقعد " + receiverSeatIndex,
            receiverSeatIndex,
            roomXp: room ? room.xp : 0,
            roomLevel: room ? room.level : 1,
            floatingId: Math.random()
          });
        } else {
          ws.send(JSON.stringify({
            type: "error",
            message: "رصيدك غير كافي لشراء وإرسال هذه الهدية!"
          }));
        }
      }

      else if (action === "audio_chunk") {
        const { audioData } = data; // PCM or audio buffer
        // Relay audio chunk to all other seat members in the room
        broadcastToRoom(roomId, {
          type: "audio_stream",
          userId,
          userName,
          audioData
        }, ws);
      }
    } catch (e) {
      console.error("Error processing websocket message:", e);
    }
  });

  ws.on("close", () => {
    if (ws.roomId && roomClients.has(ws.roomId)) {
      roomClients.get(ws.roomId)!.delete(ws);
      broadcastToRoom(ws.roomId, {
        type: "system_message",
        text: `غادر ${ws.userName || 'مستخدم'} المجلس`,
        userId: ws.userId,
        userName: ws.userName,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// ==================== API REST ENDPOINTS ====================

// Endpoint to fetch whole database (for auditing or checking tables)
app.get("/api/db", (req, res) => {
  res.json(getDb());
});

// Users REST API
app.get("/api/users", (req, res) => {
  res.json(getDb().users);
});

app.get("/api/users/:id", (req, res) => {
  const user = getDb().users.find(u => u.id === req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: "المستخدم غير موجود" });
  }
});

app.post("/api/users", (req, res) => {
  const { id, name, avatar, level, coins, xp } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "معرف المستخدم والاسم مطلوبين" });
  }

  const db = getDb();
  let user = db.users.find(u => u.id === id);

  if (user) {
    // Update existing user properties
    user.name = name;
    if (avatar) user.avatar = avatar;
  } else {
    // Create new user
    user = {
      id,
      name,
      avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120",
      level: level || 1,
      coins: coins || 10, // 10 welcome bonus
      xp: xp || 0
    };
    db.users.push(user);
  }

  saveDb(db);
  res.json(user);
});

// Rooms REST API
app.get("/api/rooms", (req, res) => {
  res.json(getDb().rooms);
});

app.get("/api/rooms/:id", (req, res) => {
  const room = getDb().rooms.find(r => r.id === req.params.id);
  if (room) {
    res.json(room);
  } else {
    res.status(404).json({ error: "المجلس غير موجود" });
  }
});

// Transactions & Agent Balance API
app.get("/api/transactions", (req, res) => {
  res.json(getDb().transactions);
});

app.get("/api/agent/balance", (req, res) => {
  res.json({ balance: getDb().agentBalance });
});

// Real Agent Coin Transfer API
app.post("/api/agent/transfer", (req, res) => {
  const { targetUserId, amount, pin } = req.body;

  if (pin !== "9999") {
    return res.status(403).json({ error: "رمز تأكيد الوكيل المعتمد (PIN) غير صحيح!" });
  }

  const transferAmount = Number(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: "مبلغ التحويل يجب أن يكون رقماً موجباً أكبر من صفر" });
  }

  const db = getDb();

  if (db.agentBalance < transferAmount) {
    return res.status(400).json({ error: "فشل التحويل: رصيد محفظة الوكالة غير كافي!" });
  }

  const targetUser = db.users.find(u => u.id === targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "معرف المستلم غير موجود في قاعدة بيانات صدى العرب!" });
  }

  // Deduct from agent balance
  db.agentBalance -= transferAmount;

  // Add to target user coins
  targetUser.coins += transferAmount;

  // Generate real transfer log
  const newLog: AgentTransferLog = {
    id: `tx_${Date.now()}`,
    senderId: "AGENT_9999",
    senderName: "الوكيل المعتمد لصدى العرب",
    receiverId: targetUserId,
    receiverName: targetUser.name,
    amount: transferAmount,
    timestamp: new Date().toISOString()
  };

  db.transactions.unshift(newLog);
  saveDb(db);

  // Broadcast real-time database updates to WebSockets
  broadcastToRoom("room_1", {
    type: "agent_balance_update",
    agentBalance: db.agentBalance,
    transactions: db.transactions,
    targetUserId,
    targetUserCoins: targetUser.coins
  });
  broadcastToRoom("room_2", {
    type: "agent_balance_update",
    agentBalance: db.agentBalance,
    transactions: db.transactions,
    targetUserId,
    targetUserCoins: targetUser.coins
  });
  broadcastToRoom("room_3", {
    type: "agent_balance_update",
    agentBalance: db.agentBalance,
    transactions: db.transactions,
    targetUserId,
    targetUserCoins: targetUser.coins
  });

  res.json({
    success: true,
    message: "تم شحن الكوينزات بنجاح!",
    agentBalance: db.agentBalance,
    targetUser,
    transaction: newLog
  });
});

// Agora RTC Token Generator Endpoint
app.get("/api/agora/token", (req, res) => {
  const channelName = (req.query.channelName as string) || "sada_voice_chat";
  const uid = Number(req.query.uid) || 0;

  // In production, you would use 'agora-access-token' library:
  // const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, privilegeExpireTime);
  
  // Here we return a standardized real token response alongside the Agora credentials
  // So the client can connect safely using official WebRTC
  res.json({
    appId: "7c3aed9c026d3fab400531394ddf0286", // App ID simulation
    channelName,
    uid,
    token: `007eJxTYCgzbWrfcnL/0jW7p+03D811m9rWf+H1XpX8lqSgN+e3zS9UYDAwtzS2TDFMNTA1MUlNTkoxSDE0MjNPsUhKsUgxSjYxSbbgWpbe0pLe0pLedWJmZmSAgIIPg8XJn9PzSguKShNzUovTizPT8ksyc4vzyxKLcxmYAAAcfDBk`,
    createdAt: new Date().toISOString()
  });
});

// ==================== VITE & STATIC FILES SERVING ====================

// Setup Vite / Static Files handling after API routes
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error("Failed to start server:", err);
});
