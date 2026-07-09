/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppUser, VoiceRoom, Gift, AgentTransferLog, FolderNode } from '../types';

export const INITIAL_GIFT_BALANCE = 10; // Welcome Bonus

export const SIMULATED_USERS: AppUser[] = [
  {
    id: '1001',
    name: 'Mason 👑',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    level: 65,
    coins: 4500,
    xp: 24000,
  },
  {
    id: '1002',
    name: 'Sophia',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    level: 99,
    coins: 12000,
    xp: 56000,
  },
  {
    id: '1003',
    name: 'Charlotte',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    level: 18,
    coins: 750,
    xp: 8500,
  },
  {
    id: '1004',
    name: 'Ava',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120',
    level: 16,
    coins: 3500,
    xp: 9800,
  },
  {
    id: '1005',
    name: 'Ryan',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120',
    level: 32,
    coins: 1500,
    xp: 1500,
  },
  {
    id: '1006',
    name: 'Aby',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=120',
    level: 20,
    coins: 800,
    xp: 3200,
  },
];

export const GIFTS: Gift[] = [
  {
    id: 'g1',
    name: 'Arabic Coffee',
    arabicName: 'قهوة شيوخ',
    icon: '☕',
    cost: 1,
    xpReward: 10,
    isPremium: false,
  },
  {
    id: 'g2',
    name: 'Oud Incense',
    arabicName: 'بخور عود',
    icon: '🪵',
    cost: 5,
    xpReward: 60,
    isPremium: false,
  },
  {
    id: 'g3',
    name: 'Arabian Falcon',
    arabicName: 'صقر شاهين',
    icon: '🦅',
    cost: 20,
    xpReward: 250,
    isPremium: true,
  },
  {
    id: 'g4',
    name: 'Luxury Sports Car',
    arabicName: 'سيارة فاخرة',
    icon: '🏎️',
    cost: 100,
    xpReward: 1500,
    isPremium: true,
  },
  {
    id: 'g5',
    name: 'Golden Dagger',
    arabicName: 'خنجر ذهبي',
    icon: '🗡️',
    cost: 500,
    xpReward: 8000,
    isPremium: true,
  },
];

export const INITIAL_ROOMS: VoiceRoom[] = [
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
      { index: 0, userId: '1001', isMuted: false, isLocked: false }, // Mason (Host)
      { index: 1, userId: '1002', isMuted: false, isLocked: false }, // Sophia
      { index: 2, userId: '1003', isMuted: false, isLocked: false }, // Charlotte
      { index: 3, userId: '1004', isMuted: false, isLocked: false }, // Ava
      { index: 4, userId: '1005', isMuted: false, isLocked: false }, // Ryan
      { index: 5, userId: '1006', isMuted: false, isLocked: false }, // Aby
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
      { index: 9, userId: null, isMuted: false, isLocked: false },
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
      { index: 0, userId: '1004', isMuted: false, isLocked: false }, // Host
      { index: 1, userId: '1001', isMuted: false, isLocked: false },
      { index: 2, userId: '1002', isMuted: false, isLocked: false },
      { index: 3, userId: '1003', isMuted: false, isLocked: false },
      { index: 4, userId: null, isMuted: false, isLocked: false },
      { index: 5, userId: null, isMuted: false, isLocked: false },
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
      { index: 9, userId: null, isMuted: false, isLocked: false },
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
      { index: 0, userId: '1002', isMuted: false, isLocked: false }, // Host
      { index: 1, userId: '1005', isMuted: false, isLocked: false },
      { index: 2, userId: null, isMuted: false, isLocked: false },
      { index: 3, userId: null, isMuted: false, isLocked: false },
      { index: 4, userId: null, isMuted: false, isLocked: false },
      { index: 5, userId: null, isMuted: false, isLocked: false },
      { index: 6, userId: null, isMuted: false, isLocked: false },
      { index: 7, userId: null, isMuted: false, isLocked: false },
      { index: 8, userId: null, isMuted: false, isLocked: false },
      { index: 9, userId: null, isMuted: false, isLocked: false },
    ],
  },
];

export const INITIAL_TRANSACTIONS: AgentTransferLog[] = [
  {
    id: 'tx_1',
    senderId: '9999', // Agent ID
    senderName: 'الوكيل الذهبي للاتصالات',
    receiverId: '1001',
    receiverName: 'أحمد العتيبي',
    amount: 150,
    timestamp: '2026-07-08T14:30:00Z',
  },
  {
    id: 'tx_2',
    senderId: '9999',
    senderName: 'الوكيل الذهبي للاتصالات',
    receiverId: '1002',
    receiverName: 'سارة القحطاني',
    amount: 500,
    timestamp: '2026-07-08T15:12:00Z',
  },
  {
    id: 'tx_3',
    senderId: '9999',
    senderName: 'الوكيل الذهبي للاتصالات',
    receiverId: '1004',
    receiverName: 'خالد الحربي',
    amount: 1000,
    timestamp: '2026-07-08T17:45:00Z',
  },
];

// Helper calculations for levels
export const getXpForNextUserLevel = (level: number) => {
  return level * 150 + 100;
};

export const getXpForNextRoomLevel = (level: number) => {
  return level * 300 + 200;
};

// Clean Architecture Flutter Directory Structure Blueprint
export const FLUTTER_FOLDER_STRUCTURE: FolderNode = {
  name: 'arab_voice_chat_app',
  type: 'folder',
  path: '',
  children: [
    {
      name: 'pubspec.yaml',
      type: 'file',
      path: 'pubspec.yaml',
      contentKey: 'pubspec'
    },
    {
      name: 'lib',
      type: 'folder',
      path: 'lib',
      children: [
        {
          name: 'main.dart',
          type: 'file',
          path: 'lib/main.dart',
          contentKey: 'main'
        },
        {
          name: 'core',
          type: 'folder',
          path: 'lib/core',
          children: [
            {
              name: 'theme',
              type: 'folder',
              path: 'lib/core/theme',
              children: [
                {
                  name: 'app_theme.dart',
                  type: 'file',
                  path: 'lib/core/theme/app_theme.dart',
                  contentKey: 'app_theme'
                }
              ]
            },
            {
              name: 'constants',
              type: 'folder',
              path: 'lib/core/constants',
              children: [
                {
                  name: 'constants.dart',
                  type: 'file',
                  path: 'lib/core/constants/constants.dart',
                  contentKey: 'constants'
                }
              ]
            },
            {
              name: 'services',
              type: 'folder',
              path: 'lib/core/services',
              children: [
                {
                  name: 'webrtc_service.dart',
                  type: 'file',
                  path: 'lib/core/services/webrtc_service.dart',
                  contentKey: 'webrtc_service'
                },
                {
                  name: 'economy_service.dart',
                  type: 'file',
                  path: 'lib/core/services/economy_service.dart',
                  contentKey: 'economy_service'
                }
              ]
            }
          ]
        },
        {
          name: 'features',
          type: 'folder',
          path: 'lib/features',
          children: [
            {
              name: 'auth',
              type: 'folder',
              path: 'lib/features/auth',
              children: [
                {
                  name: 'data',
                  type: 'folder',
                  path: 'lib/features/auth/data'
                },
                {
                  name: 'domain',
                  type: 'folder',
                  path: 'lib/features/auth/domain'
                },
                {
                  name: 'presentation',
                  type: 'folder',
                  path: 'lib/features/auth/presentation',
                  children: [
                    {
                      name: 'login_screen.dart',
                      type: 'file',
                      path: 'lib/features/auth/presentation/login_screen.dart',
                      contentKey: 'login_screen'
                    }
                  ]
                }
              ]
            },
            {
              name: 'voice_room',
              type: 'folder',
              path: 'lib/features/voice_room',
              children: [
                {
                  name: 'bloc',
                  type: 'folder',
                  path: 'lib/features/voice_room/bloc',
                  children: [
                    {
                      name: 'seat_management_bloc.dart',
                      type: 'file',
                      path: 'lib/features/voice_room/bloc/seat_management_bloc.dart',
                      contentKey: 'seat_management_bloc'
                    }
                  ]
                },
                {
                  name: 'models',
                  type: 'folder',
                  path: 'lib/features/voice_room/models',
                  children: [
                    {
                      name: 'room_model.dart',
                      type: 'file',
                      path: 'lib/features/voice_room/models/room_model.dart',
                      contentKey: 'room_model'
                    }
                  ]
                },
                {
                  name: 'presentation',
                  type: 'folder',
                  path: 'lib/features/voice_room/presentation',
                  children: [
                    {
                      name: 'room_view_widget.dart',
                      type: 'file',
                      path: 'lib/features/voice_room/presentation/room_view_widget.dart',
                      contentKey: 'room_view_widget'
                    }
                  ]
                }
              ]
            },
            {
              name: 'agent_dashboard',
              type: 'folder',
              path: 'lib/features/agent_dashboard',
              children: [
                {
                  name: 'presentation',
                  type: 'folder',
                  path: 'lib/features/agent_dashboard/presentation',
                  children: [
                    {
                      name: 'agent_dashboard_widget.dart',
                      type: 'file',
                      path: 'lib/features/agent_dashboard/presentation/agent_dashboard_widget.dart',
                      contentKey: 'agent_dashboard_widget'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
