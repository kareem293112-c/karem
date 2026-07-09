import fs from 'fs';
import path from 'path';
import { AppUser, VoiceRoom, AgentTransferLog } from '../src/types';

const DB_FILE = path.join(process.cwd(), 'db.json');

export interface DatabaseSchema {
  users: AppUser[];
  rooms: VoiceRoom[];
  transactions: AgentTransferLog[];
  agentBalance: number;
}

const DEFAULT_USERS: AppUser[] = [
  {
    id: '1001',
    name: 'أحمد العتيبي',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    level: 15,
    coins: 450,
    xp: 2400,
    isAgent: true
  },
  {
    id: '1002',
    name: 'سارة القحطاني',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    level: 28,
    coins: 1200,
    xp: 5600,
  },
  {
    id: '1003',
    name: 'ياسر الشمري',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120',
    level: 8,
    coins: 75,
    xp: 850,
  },
  {
    id: '1004',
    name: 'خالد الحربي',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    level: 34,
    coins: 3500,
    xp: 9800,
  },
  {
    id: '1005',
    name: 'ريم الدوسري',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120',
    level: 4,
    coins: 10,
    xp: 150,
  },
];

const DEFAULT_ROOMS: VoiceRoom[] = [
  {
    id: 'room_1',
    name: 'مجلس ديوانية العرب ☕',
    hostName: 'أحمد العتيبي',
    hostAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    isPrivate: false,
    level: 12,
    xp: 1800,
    activeUsersCount: 24,
    seats: [
      { index: 0, userId: '1001', isMuted: false, isLocked: false },
      { index: 1, userId: '1002', isMuted: false, isLocked: false },
      { index: 2, userId: '1003', isMuted: true, isLocked: false },
      { index: 3, userId: null, isMuted: false, isLocked: false },
      { index: 4, userId: '1004', isMuted: false, isLocked: false },
      { index: 5, userId: null, isMuted: false, isLocked: true },
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
    ],
  },
  {
    id: 'room_2',
    name: 'سهرة الطرب الأصيل 🎶',
    hostName: 'خالد الحربي',
    hostAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    isPrivate: false,
    level: 25,
    xp: 5400,
    activeUsersCount: 89,
    seats: [
      { index: 0, userId: '1004', isMuted: false, isLocked: false },
      { index: 1, userId: '1001', isMuted: false, isLocked: false },
      { index: 2, userId: '1002', isMuted: false, isLocked: false },
      { index: 3, userId: '1003', isMuted: false, isLocked: false },
      { index: 4, userId: null, isMuted: false, isLocked: false },
      { index: 5, userId: null, isMuted: false, isLocked: false },
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
    ],
  },
  {
    id: 'room_3',
    name: 'مجلس سري خاص 🔒',
    hostName: 'سارة القحطاني',
    hostAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    isPrivate: true,
    password: '123',
    level: 8,
    xp: 900,
    activeUsersCount: 5,
    seats: [
      { index: 0, userId: '1002', isMuted: false, isLocked: false },
      { index: 1, userId: '1005', isMuted: false, isLocked: false },
      { index: 2, userId: null, isMuted: false, isLocked: false },
      { index: 3, userId: null, isMuted: false, isLocked: false },
      { index: 4, userId: null, isMuted: false, isLocked: false },
      { index: 5, userId: null, isMuted: false, isLocked: false },
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
    ],
  },
];

const DEFAULT_TRANSACTIONS: AgentTransferLog[] = [
  {
    id: 'tx_1',
    senderId: 'AGENT_9999',
    senderName: 'الوكيل المعتمد لصدى العرب',
    receiverId: '1001',
    receiverName: 'أحمد العتيبي',
    amount: 1500,
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'tx_2',
    senderId: 'AGENT_9999',
    senderName: 'الوكيل المعتمد لصدى العرب',
    receiverId: '1002',
    receiverName: 'سارة القحطاني',
    amount: 3000,
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

export function initDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const defaultDb: DatabaseSchema = {
      users: DEFAULT_USERS,
      rooms: DEFAULT_ROOMS,
      transactions: DEFAULT_TRANSACTIONS,
      agentBalance: 250000,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading db.json, recreating...', error);
    const defaultDb: DatabaseSchema = {
      users: DEFAULT_USERS,
      rooms: DEFAULT_ROOMS,
      transactions: DEFAULT_TRANSACTIONS,
      agentBalance: 250000,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }
}

export function getDb(): DatabaseSchema {
  return initDb();
}

export function saveDb(data: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
