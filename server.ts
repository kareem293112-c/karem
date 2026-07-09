import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { getDb, saveDb, initDb, DatabaseSchema } from "./server/db";
import { AppUser, VoiceRoom, AgentTransferLog, VoiceSeat } from "./src/types";
import * as admin from "firebase-admin";

// Initialize database
initDb();

// Initialize Firebase Admin SDK lazily to prevent boot crashes if credentials are missing
let firestoreDbInstance: any = null;
let firebaseInitialized = false;

function getFirestoreDb() {
  if (!firebaseInitialized) {
    try {
      if ((admin as any).apps.length === 0) {
        const customDbId = "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698";
        const projectId = "gen-lang-client-0348881645";
        
        (admin as any).initializeApp({
          credential: (admin as any).credential.applicationDefault(),
          projectId: projectId
        });
        
        const { getFirestore } = require("firebase-admin/firestore");
        firestoreDbInstance = getFirestore((admin as any).apps[0], customDbId);
      } else {
        const customDbId = "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698";
        const { getFirestore } = require("firebase-admin/firestore");
        firestoreDbInstance = getFirestore((admin as any).apps[0], customDbId);
      }
      firebaseInitialized = true;
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
      console.warn("Firebase Admin SDK failed to initialize. Falling back to local file database:", error.message || error);
      firestoreDbInstance = null;
      firebaseInitialized = true;
    }
  }
  return firestoreDbInstance;
}

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

// ==================== NEW VOICE ROOM API ENDPOINTS ====================
app.post("/api/rooms/create", async (req, res) => {
  const { room_name, owner_id } = req.body;
  const tencent_room_id = Math.floor(Math.random() * 1000000);
  
  const fDb = getFirestoreDb();
  if (fDb) {
    try {
      const roomRef = await fDb.collection("voice_rooms").add({
        room_name,
        owner_id,
        tencent_room_id,
        is_private: false,
        max_seats: 8,
        created_at: (admin as any).firestore.FieldValue.serverTimestamp()
      });
      
      // Create seats
      for (let i = 1; i <= 8; i++) {
        await roomRef.collection("mic_seats").doc(i.toString()).set({
          seat_number: i,
          current_user_id: null,
          is_locked: false,
          is_muted: false
        });
      }
      
      return res.json({ room_id: roomRef.id, tencent_room_id });
    } catch (error) {
      console.error("Firestore error creating room:", error);
    }
  }

  // Fallback to local DB
  const localDb = getDb();
  const newRoomId = "room_" + (localDb.rooms.length + 1);
  const seats = Array.from({ length: 8 }, (_, i) => ({
    index: i + 1, // 1 to 8
    userId: null,
    isMuted: false,
    isLocked: false
  }));
  
  const newRoom: any = {
    id: newRoomId,
    name: room_name,
    hostName: owner_id,
    hostAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
    isPrivate: false,
    level: 1,
    xp: 0,
    activeUsersCount: 1,
    seats: seats,
    tencent_room_id: tencent_room_id
  };
  
  localDb.rooms.push(newRoom);
  saveDb(localDb);
  res.json({ room_id: newRoomId, tencent_room_id });
});

app.post("/api/rooms/seats/take", async (req, res) => {
    const { room_id, seat_number, user_id } = req.body;
    const fDb = getFirestoreDb();
    if (fDb) {
      try {
        const seatRef = fDb.collection("voice_rooms").doc(room_id).collection("mic_seats").doc(seat_number.toString());
        const seatDoc = await seatRef.get();
        if (!seatDoc.exists) return res.status(404).json({ error: "Seat not found" });
        if (seatDoc.data()?.is_locked) return res.status(403).json({ error: "Seat is locked" });
        
        await seatRef.update({ current_user_id: user_id });
        return res.json({ success: true });
      } catch (error) {
        console.error("Firestore error taking seat:", error);
      }
    }

    // Fallback to local DB
    const localDb = getDb();
    const room = localDb.rooms.find(r => r.id === room_id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const seat = room.seats.find((s: any) => s.index === Number(seat_number));
    if (!seat) return res.status(404).json({ error: "Seat not found" });
    if (seat.isLocked) return res.status(403).json({ error: "Seat is locked" });

    seat.userId = user_id;
    saveDb(localDb);
    res.json({ success: true });
});

app.post("/api/rooms/seats/leave", async (req, res) => {
    const { room_id, seat_number } = req.body;
    const fDb = getFirestoreDb();
    if (fDb) {
      try {
        await fDb.collection("voice_rooms").doc(room_id).collection("mic_seats").doc(seat_number.toString()).update({ current_user_id: null });
        return res.json({ success: true });
      } catch (error) {
        console.error("Firestore error leaving seat:", error);
      }
    }

    // Fallback to local DB
    const localDb = getDb();
    const room = localDb.rooms.find(r => r.id === room_id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const seat = room.seats.find((s: any) => s.index === Number(seat_number));
    if (!seat) return res.status(404).json({ error: "Seat not found" });

    seat.userId = null;
    saveDb(localDb);
    res.json({ success: true });
});

app.post("/api/rooms/seats/lock", async (req, res) => {
    const { room_id, seat_number, is_locked } = req.body;
    const fDb = getFirestoreDb();
    if (fDb) {
      try {
        await fDb.collection("voice_rooms").doc(room_id).collection("mic_seats").doc(seat_number.toString()).update({ is_locked });
        return res.json({ success: true });
      } catch (error) {
        console.error("Firestore error locking seat:", error);
      }
    }

    // Fallback to local DB
    const localDb = getDb();
    const room = localDb.rooms.find(r => r.id === room_id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const seat = room.seats.find((s: any) => s.index === Number(seat_number));
    if (!seat) return res.status(404).json({ error: "Seat not found" });

    seat.isLocked = is_locked;
    saveDb(localDb);
    res.json({ success: true });
});

app.post("/api/rooms/seats/mute", async (req, res) => {
    const { room_id, seat_number, is_muted } = req.body;
    const fDb = getFirestoreDb();
    if (fDb) {
      try {
        await fDb.collection("voice_rooms").doc(room_id).collection("mic_seats").doc(seat_number.toString()).update({ is_muted });
        return res.json({ success: true });
      } catch (error) {
        console.error("Firestore error muting seat:", error);
      }
    }

    // Fallback to local DB
    const localDb = getDb();
    const room = localDb.rooms.find(r => r.id === room_id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const seat = room.seats.find((s: any) => s.index === Number(seat_number));
    if (!seat) return res.status(404).json({ error: "Seat not found" });

    seat.isMuted = is_muted;
    saveDb(localDb);
    res.json({ success: true });
});

// Predefined fallback gifts for the system
const DEFAULT_GIFTS: { [key: string]: { gift_name: string; coin_price: number; animation_url: string } } = {
  rose: { gift_name: "وردة", coin_price: 1, animation_url: "rose" },
  car: { gift_name: "سيارة فاخرة", coin_price: 1000, animation_url: "car" },
  lion: { gift_name: "أسد مهيب", coin_price: 5000, animation_url: "lion" },
  yacht: { gift_name: "يخت ملكي", coin_price: 10000, animation_url: "yacht" },
  castle: { gift_name: "قصر الأساطير", coin_price: 20000, animation_url: "castle" }
};

function calculateVipLevel(xp: number): number {
  if (xp >= 200000) return 7;
  if (xp >= 50000) return 6;
  if (xp >= 10000) return 5;
  if (xp >= 2000) return 4;
  if (xp >= 500) return 3;
  if (xp >= 100) return 2;
  return 1;
}

// Virtual Gifting and Balance Transfer API with Firestore transactions, gamification, and safety fallbacks
app.post("/api/gifts/send", async (req, res) => {
  const { room_id, sender_id, receiver_id, gift_id } = req.body;
  if (!sender_id || !gift_id) {
    return res.status(400).json({ error: "Sender and Gift ID are required" });
  }

  let gift = DEFAULT_GIFTS[gift_id];
  if (!gift) {
    gift = { gift_name: gift_id, coin_price: 10, animation_url: gift_id };
  }

  const fDb = getFirestoreDb();
  if (fDb) {
    try {
      const giftDoc = await fDb.collection("gifts").doc(gift_id).get();
      if (giftDoc.exists) {
        const d = giftDoc.data();
        gift = {
          gift_name: d.gift_name || gift.gift_name,
          coin_price: d.coin_price !== undefined ? d.coin_price : gift.coin_price,
          animation_url: d.animation_url || gift.animation_url
        };
      }
    } catch (e) {
      console.warn("Could not fetch gift from Firestore, using default:", e);
    }

    try {
      const senderRef = fDb.collection("users").doc(sender_id);
      const receiverRef = receiver_id ? fDb.collection("users").doc(receiver_id) : null;

      const result = await fDb.runTransaction(async (transaction: any) => {
        const senderDoc = await transaction.get(senderRef);
        let senderBalance = 0;
        let currentSenderXp = 0;
        let currentSenderBadges: string[] = [];
        let senderClanId: string | null = null;

        if (!senderDoc.exists) {
          // Auto-provision user if they do not exist
          transaction.set(senderRef, {
            user_id: sender_id,
            username: "User_" + sender_id,
            coins_balance: 10000, // Initial balance for smooth demo
            vip_level: 1,
            sender_xp: 0,
            charm_xp: 0,
            badges: [],
            created_at: (admin as any).firestore.FieldValue.serverTimestamp()
          });
          senderBalance = 10000;
          currentSenderXp = 0;
          currentSenderBadges = [];
        } else {
          const sData = senderDoc.data();
          senderBalance = sData.coins_balance || 0;
          currentSenderXp = sData.sender_xp || 0;
          currentSenderBadges = sData.badges || [];
          senderClanId = sData.clan_id || null;
        }

        if (senderBalance < gift.coin_price) {
          throw new Error("Insufficient Balance");
        }

        const newSenderBalance = senderBalance - gift.coin_price;
        const newSenderXp = currentSenderXp + gift.coin_price;
        const newVipLevel = calculateVipLevel(newSenderXp);

        // Check Diamond Supporter badge (50k XP)
        const updatedSenderBadges = [...currentSenderBadges];
        if (newSenderXp >= 50000 && !updatedSenderBadges.includes("diamond_supporter")) {
          updatedSenderBadges.push("diamond_supporter");
        }

        transaction.update(senderRef, { 
          coins_balance: newSenderBalance,
          sender_xp: newSenderXp,
          vip_level: newVipLevel,
          badges: updatedSenderBadges
        });

        // Handle receiver charm XP and VIP Level (or just charm_xp)
        if (receiverRef) {
          const receiverDoc = await transaction.get(receiverRef);
          let currentReceiverXp = 0;
          let currentReceiverBadges: string[] = [];
          let receiverBalance = 0;

          if (receiverDoc.exists) {
            const rData = receiverDoc.data();
            receiverBalance = rData.coins_balance || 0;
            currentReceiverXp = rData.charm_xp || 0;
            currentReceiverBadges = rData.badges || [];
            
            const newReceiverXp = currentReceiverXp + gift.coin_price;
            const updatedReceiverBadges = [...currentReceiverBadges];
            if (newReceiverXp >= 10000 && !updatedReceiverBadges.includes("elite_host")) {
              updatedReceiverBadges.push("elite_host");
            }

            transaction.update(receiverRef, { 
              coins_balance: receiverBalance + gift.coin_price,
              charm_xp: newReceiverXp,
              badges: updatedReceiverBadges
            });
          } else {
            const updatedReceiverBadges = [];
            if (gift.coin_price >= 10000) {
              updatedReceiverBadges.push("elite_host");
            }
            transaction.set(receiverRef, {
              user_id: receiver_id,
              username: "User_" + receiver_id,
              coins_balance: gift.coin_price,
              vip_level: 1,
              sender_xp: 0,
              charm_xp: gift.coin_price,
              badges: updatedReceiverBadges,
              created_at: (admin as any).firestore.FieldValue.serverTimestamp()
            });
          }
        }

        // Handle Clan total_xp increase
        if (senderClanId) {
          const clanRef = fDb.collection("clans").doc(senderClanId);
          const clanDoc = await transaction.get(clanRef);
          if (clanDoc.exists) {
            const currentClanXp = clanDoc.data().total_xp || 0;
            transaction.update(clanRef, { total_xp: currentClanXp + gift.coin_price });
          }
        }

        // Log the event
        const logRef = fDb.collection("gift_logs").doc();
        transaction.set(logRef, {
          room_id: room_id || "global",
          sender_id,
          receiver_id: receiver_id || null,
          gift_id,
          gift_name: gift.gift_name,
          coin_price: gift.coin_price,
          timestamp: (admin as any).firestore.FieldValue.serverTimestamp()
        });

        return { senderBalance: newSenderBalance, newSenderXp, newVipLevel, updatedSenderBadges };
      });

      return res.json({
        success: true,
        message: "تم إرسال الهدية بنجاح",
        sender_balance: result.senderBalance,
        sender_xp: result.newSenderXp,
        vip_level: result.newVipLevel,
        badges: result.updatedSenderBadges,
        gift
      });
    } catch (error: any) {
      console.error("Firestore transaction failed for sending gift:", error);
      if (error.message === "Insufficient Balance") {
        return res.status(400).json({ error: "Insufficient Balance" });
      }
    }
  }

  // Fallback to Local DB
  const localDb = getDb();
  const sender = localDb.users.find(u => u.id === sender_id);
  if (!sender) {
    return res.status(404).json({ error: "المرسل غير موجود" });
  }

  if (sender.coins < gift.coin_price) {
    return res.status(400).json({ error: "Insufficient Balance" });
  }

  sender.coins -= gift.coin_price;
  sender.senderXp = (sender.senderXp || 0) + gift.coin_price;
  sender.vipLevel = calculateVipLevel(sender.senderXp);

  if (!sender.badges) sender.badges = [];
  if (sender.senderXp >= 50000 && !sender.badges.includes("diamond_supporter")) {
    sender.badges.push("diamond_supporter");
  }

  if (receiver_id) {
    const receiver = localDb.users.find(u => u.id === receiver_id);
    if (receiver) {
      receiver.coins += gift.coin_price;
      receiver.charmXp = (receiver.charmXp || 0) + gift.coin_price;
      if (!receiver.badges) receiver.badges = [];
      if (receiver.charmXp >= 10000 && !receiver.badges.includes("elite_host")) {
        receiver.badges.push("elite_host");
      }
    }
  }

  // Handle local Clan XP
  if (sender.clanId) {
    const clan = (localDb.clans || []).find((c: any) => c.clanId === sender.clanId);
    if (clan) {
      clan.totalXp = (clan.totalXp || 0) + gift.coin_price;
    }
  }

  if (!localDb.giftLogs) {
    (localDb as any).giftLogs = [];
  }
  (localDb as any).giftLogs.push({
    id: "glog_" + Date.now(),
    roomId: room_id || "global",
    senderId: sender_id,
    receiverId: receiver_id || null,
    giftId: gift_id,
    timestamp: new Date().toISOString()
  });

  saveDb(localDb);
  res.json({
    success: true,
    message: "تم إرسال الهدية بنجاح",
    sender_balance: sender.coins,
    sender_xp: sender.senderXp,
    vip_level: sender.vipLevel,
    badges: sender.badges,
    gift
  });
});

// GET /api/leaderboard: Leaderboards for Senders, Receivers, and Clans
app.get("/api/leaderboard", async (req, res) => {
  const fDb = getFirestoreDb();
  if (fDb) {
    try {
      const topSendersSnap = await fDb.collection("users").orderBy("sender_xp", "desc").limit(10).get();
      const topReceiversSnap = await fDb.collection("users").orderBy("charm_xp", "desc").limit(10).get();
      const topClansSnap = await fDb.collection("clans").orderBy("total_xp", "desc").limit(10).get();

      const senders = topSendersSnap.docs.map((doc: any) => ({
        id: doc.id,
        name: doc.data().username,
        avatar: doc.data().avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120",
        xp: doc.data().sender_xp || 0,
        vipLevel: doc.data().vip_level || 1,
        badges: doc.data().badges || []
      }));

      const receivers = topReceiversSnap.docs.map((doc: any) => ({
        id: doc.id,
        name: doc.data().username,
        avatar: doc.data().avatar_url || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
        xp: doc.data().charm_xp || 0,
        vipLevel: doc.data().vip_level || 1,
        badges: doc.data().badges || []
      }));

      const clans = topClansSnap.docs.map((doc: any) => ({
        clanId: doc.id,
        clanName: doc.data().clan_name,
        clanLogo: doc.data().clan_logo || "🛡️",
        ownerId: doc.data().owner_id,
        totalXp: doc.data().total_xp || 0
      }));

      return res.json({ senders, receivers, clans });
    } catch (e) {
      console.warn("Firestore leaderboard fetch failed, falling back to local:", e);
    }
  }

  // Fallback local leaderboard
  const localDb = getDb();
  const senders = [...localDb.users]
    .sort((a, b) => (b.senderXp || 0) - (a.senderXp || 0))
    .slice(0, 10)
    .map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      xp: u.senderXp || 0,
      vipLevel: u.vipLevel || 1,
      badges: u.badges || []
    }));

  const receivers = [...localDb.users]
    .sort((a, b) => (b.charmXp || 0) - (a.charmXp || 0))
    .slice(0, 10)
    .map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      xp: u.charmXp || 0,
      vipLevel: u.vipLevel || 1,
      badges: u.badges || []
    }));

  const clans = [...(localDb.clans || [])]
    .sort((a, b) => (b.totalXp || 0) - (a.totalXp || 0))
    .slice(0, 10);

  res.json({ senders, receivers, clans });
});

// POST /api/clans/create: Create a new clan for 1000 coins
app.post("/api/clans/create", async (req, res) => {
  const { clan_name, clan_logo, owner_id } = req.body;
  if (!clan_name || !owner_id) {
    return res.status(400).json({ error: "اسم العائلة ومعرف المالك مطلوبان" });
  }

  const clan_id = "clan_" + Math.floor(Math.random() * 1000000);
  const clan_logo_url = clan_logo || "🛡️";

  const fDb = getFirestoreDb();
  if (fDb) {
    try {
      const userRef = fDb.collection("users").doc(owner_id);
      await fDb.runTransaction(async (transaction: any) => {
        const userDoc = await transaction.get(userRef);
        let balance = 0;
        let badges = [];

        if (userDoc.exists) {
          balance = userDoc.data().coins_balance || 0;
          badges = userDoc.data().badges || [];
        } else {
          // Provision user if they didn't exist (demo convenience)
          balance = 10000;
        }

        if (balance < 1000) {
          throw new Error("Insufficient Balance for Clan creation");
        }

        const updatedBadges = [...badges];
        if (!updatedBadges.includes("loyal_member")) {
          updatedBadges.push("loyal_member");
        }

        transaction.update(userRef, { 
          coins_balance: balance - 1000, 
          clan_id: clan_id,
          badges: updatedBadges
        });

        const clanRef = fDb.collection("clans").doc(clan_id);
        transaction.set(clanRef, {
          clan_id,
          clan_name,
          clan_logo: clan_logo_url,
          owner_id,
          total_xp: 0,
          created_at: (admin as any).firestore.FieldValue.serverTimestamp()
        });
      });

      return res.json({ success: true, clan_id, message: "تم إنشاء العائلة بنجاح!" });
    } catch (error: any) {
      console.error("Firestore clan creation failed:", error);
      if (error.message.includes("Insufficient Balance")) {
        return res.status(400).json({ error: "عذراً، رصيدك غير كافي لإنشاء عائلة (تحتاج 1000 كوين)" });
      }
    }
  }

  // Fallback to Local DB
  const localDb = getDb();
  const owner = localDb.users.find(u => u.id === owner_id);
  if (!owner) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (owner.coins < 1000) {
    return res.status(400).json({ error: "عذراً، رصيدك غير كافي لإنشاء عائلة (تحتاج 1000 كوين)" });
  }

  owner.coins -= 1000;
  owner.clanId = clan_id;
  if (!owner.badges) owner.badges = [];
  if (!owner.badges.includes("loyal_member")) {
    owner.badges.push("loyal_member");
  }

  if (!localDb.clans) {
    localDb.clans = [];
  }

  localDb.clans.push({
    clanId: clan_id,
    clanName: clan_name,
    clanLogo: clan_logo_url,
    ownerId: owner_id,
    totalXp: 0
  });

  saveDb(localDb);
  res.json({ success: true, clan_id, message: "تم إنشاء العائلة بنجاح!" });
});

// POST /api/clans/join: Join a clan
app.post("/api/clans/join", async (req, res) => {
  const { clan_id, user_id } = req.body;
  if (!clan_id || !user_id) {
    return res.status(400).json({ error: "معرف العائلة والملقن مطلوبان" });
  }

  const fDb = getFirestoreDb();
  if (fDb) {
    try {
      const userRef = fDb.collection("users").doc(user_id);
      await fDb.runTransaction(async (transaction: any) => {
        const userDoc = await transaction.get(userRef);
        let badges = [];
        if (userDoc.exists) {
          badges = userDoc.data().badges || [];
        }

        const updatedBadges = [...badges];
        if (!updatedBadges.includes("loyal_member")) {
          updatedBadges.push("loyal_member");
        }

        transaction.update(userRef, { 
          clan_id: clan_id,
          badges: updatedBadges
        });
      });
      return res.json({ success: true, message: "تم الانضمام للعائلة بنجاح!" });
    } catch (error) {
      console.error("Firestore clan join failed:", error);
    }
  }

  // Fallback to Local DB
  const localDb = getDb();
  const user = localDb.users.find(u => u.id === user_id);
  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  user.clanId = clan_id;
  if (!user.badges) user.badges = [];
  if (!user.badges.includes("loyal_member")) {
    user.badges.push("loyal_member");
  }

  saveDb(localDb);
  res.json({ success: true, message: "تم الانضمام للعائلة بنجاح!" });
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

// ==================== FOLLOW & PROFILE & PRIVATE MESSAGING ENDPOINTS ====================

import { PrivateMessage } from "./src/types";

// Follow / Unfollow User API
app.post("/api/users/follow", (req, res) => {
  const { followerId, followingId } = req.body;
  if (!followerId || !followingId) {
    return res.status(400).json({ error: "معرف المتابع والمعتمَد مطلوبان" });
  }
  if (followerId === followingId) {
    return res.status(400).json({ error: "لا يمكنك متابعة نفسك!" });
  }

  const db = getDb();
  const follower = db.users.find(u => u.id === followerId);
  const following = db.users.find(u => u.id === followingId);

  if (!follower || !following) {
    return res.status(404).json({ error: "المستخدم غير موجود في قاعدة البيانات" });
  }

  // Ensure arrays exist
  if (!follower.following) follower.following = [];
  if (!following.followers) following.followers = [];

  const followIndex = follower.following.indexOf(followingId);
  let isFollowing = false;

  if (followIndex !== -1) {
    // Unfollow
    follower.following.splice(followIndex, 1);
    const followerIndex = following.followers.indexOf(followerId);
    if (followerIndex !== -1) {
      following.followers.splice(followerIndex, 1);
    }
    isFollowing = false;
  } else {
    // Follow
    follower.following.push(followingId);
    following.followers.push(followerId);
    isFollowing = true;
  }

  saveDb(db);
  res.json({ success: true, isFollowing, follower, following });
});

// Update Profile API
app.post("/api/users/update-profile", (req, res) => {
  const { id, name, avatar, bio } = req.body;
  if (!id) {
    return res.status(400).json({ error: "معرف المستخدم مطلوب" });
  }

  const db = getDb();
  const user = db.users.find(u => u.id === id);

  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  if (bio !== undefined) user.bio = bio;

  saveDb(db);
  res.json({ success: true, user });
});

// Get Private Messages for User
app.get("/api/messages/:userId", (req, res) => {
  const { userId } = req.params;
  const db = getDb();
  if (!db.privateMessages) db.privateMessages = [];
  
  const userMsgs = db.privateMessages.filter(
    m => m.senderId === userId || m.receiverId === userId
  );
  res.json(userMsgs);
});

// Send Private Message
app.post("/api/messages", (req, res) => {
  const { senderId, receiverId, text, isEncrypted, rawCiphertext, iv } = req.body;
  if (!senderId || !receiverId || !text) {
    return res.status(400).json({ error: "المرسل والمستقبل ونص الرسالة مطلوبين" });
  }

  const db = getDb();
  const sender = db.users.find(u => u.id === senderId);
  const receiver = db.users.find(u => u.id === receiverId);

  if (!sender || !receiver) {
    return res.status(404).json({ error: "المستخدم المرسل أو المستقبل غير موجود" });
  }

  const newMessage: PrivateMessage = {
    id: `pm_${Date.now()}_${Math.random().toString(36).substring(4)}`,
    senderId,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    receiverId,
    receiverName: receiver.name,
    text,
    timestamp: new Date().toISOString(),
    isEncrypted,
    rawCiphertext,
    iv
  };

  if (!db.privateMessages) db.privateMessages = [];
  db.privateMessages.push(newMessage);
  saveDb(db);

  // Broadcast in real-time to active WebSocket clients if they are connected
  const wsMessage = {
    type: "new_private_message",
    message: newMessage
  };
  
  const msgStr = JSON.stringify(wsMessage);
  // Iterate over all connected sockets across all rooms
  for (const [roomId, clients] of roomClients) {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && (client.userId === receiverId || client.userId === senderId)) {
        client.send(msgStr);
      }
    }
  }

  res.json({ success: true, message: newMessage });
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
