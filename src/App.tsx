/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Search,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Plus,
  Send,
  Coins,
  Award,
  ShieldAlert,
  Check,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  User,
  Music,
  Settings,
  LogOut,
  Key,
  RefreshCw,
  Play,
  Flame,
  Zap,
  Sparkles,
  Clock,
  ShieldCheck,
  Info,
  Phone,
  Mail,
  UserCheck,
  Wifi
} from 'lucide-react';
import {
  SIMULATED_USERS,
  INITIAL_ROOMS,
  GIFTS,
  INITIAL_TRANSACTIONS,
  FLUTTER_FOLDER_STRUCTURE,
  INITIAL_GIFT_BALANCE,
  getXpForNextUserLevel,
  getXpForNextRoomLevel
} from './data/mockData';
import { DART_BLUEPRINTS } from './data/dartBlueprints';
import { AppUser, VoiceRoom, Gift, AgentTransferLog, FolderNode, VoiceSeat } from './types';

export default function App() {
  // Global States representing Database
  const [users, setUsers] = useState<AppUser[]>(SIMULATED_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [rooms, setRooms] = useState<VoiceRoom[]>(INITIAL_ROOMS);
  const [activeRoom, setActiveRoom] = useState<VoiceRoom | null>(null);
  const [transactions, setTransactions] = useState<AgentTransferLog[]>(INITIAL_TRANSACTIONS);
  const [agentBalance, setAgentBalance] = useState<number>(248350);

  // App Simulator Screen Navigation: 'login' | 'explore' | 'room' | 'agent_pin' | 'agent_dashboard'
  const [currentScreen, setCurrentScreen] = useState<'login' | 'explore' | 'room' | 'agent_pin' | 'agent_dashboard'>('login');
  
  // Login input fields
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email' | 'google' | 'apple' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsOtp, setSmsOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customName, setCustomName] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);

  // Explore Room Lock PIN state
  const [selectedLockedRoom, setSelectedLockedRoom] = useState<VoiceRoom | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomPasswordError, setRoomPasswordError] = useState(false);

  // Voice Room interactive state
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [floatingGifts, setFloatingGifts] = useState<{ id: number; icon: string; x: number; y: number }[]>([]);
  const [vipEntrance, setVipEntrance] = useState<{ active: boolean; userName: string; level: number } | null>(null);
  const floatingIdCounter = useRef(0);

  // Agent Dashboard states
  const [agentPinInput, setAgentPinInput] = useState('');
  const [agentPinError, setAgentPinError] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferTargetUser, setTransferTargetUser] = useState<AppUser | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPin, setTransferPin] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferErrorMsg, setTransferErrorMsg] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Dynamic DB state fetching
  const fetchDbStates = async () => {
    try {
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
        if (currentUser) {
          const matchedUser = usersData.find((u: any) => u.id === currentUser.id);
          if (matchedUser) {
            setCurrentUser(matchedUser);
          }
        }
      }

      const roomsRes = await fetch('/api/rooms');
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData);
        if (activeRoom) {
          const matchedRoom = roomsData.find((r: any) => r.id === activeRoom.id);
          if (matchedRoom) {
            setActiveRoom(matchedRoom);
          }
        }
      }

      const txRes = await fetch('/api/transactions');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }

      const agentRes = await fetch('/api/agent/balance');
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        setAgentBalance(agentData.balance);
      }
    } catch (e) {
      console.error('Error fetching database states:', e);
    }
  };

  // Run on mount and keep polling (fallback/sync)
  useEffect(() => {
    fetchDbStates();
    const interval = setInterval(fetchDbStates, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, activeRoom?.id]);

  // Play incoming voice stream audio via Web Audio API
  const playAudioChunk = (speakerId: string, pcmData: number[]) => {
    if (speakerId === currentUser?.id) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!(window as any).sharedAudioContext) {
        (window as any).sharedAudioContext = new AudioContextClass();
      }
      const ctx = (window as any).sharedAudioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const buffer = ctx.createBuffer(1, pcmData.length, ctx.sampleRate || 44100);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channel[i] = pcmData[i];
      }
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();

      // Trigger speaking wave indicator on seat
      if (activeRoom) {
        const seatIdx = activeRoom.seats.findIndex(s => s.userId === speakerId);
        if (seatIdx !== -1) {
          setSpeakingSeatIndex(seatIdx);
          if (!(window as any).speakingTimers) (window as any).speakingTimers = {};
          if ((window as any).speakingTimers[speakerId]) {
            clearTimeout((window as any).speakingTimers[speakerId]);
          }
          (window as any).speakingTimers[speakerId] = setTimeout(() => {
            setSpeakingSeatIndex(null);
          }, 450);
        }
      }
    } catch (e) {
      // Audio auto-play block bypass
    }
  };

  // Microphone capture and streaming over WebSocket
  const startVoiceCapture = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Microphone API is not supported in this browser.");
        return;
      }
      stopVoiceCapture();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            action: 'audio_chunk',
            roomId: activeRoom?.id,
            userId: currentUser?.id,
            userName: currentUser?.name,
            audioData: Array.from(inputData)
          }));
        }
      };
      console.log("Real-time voice stream active!");
    } catch (err) {
      console.error("Failed to capture microphone voice stream:", err);
    }
  };

  const stopVoiceCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // WebSocket lifecycle listener
  useEffect(() => {
    if (!activeRoom || !currentUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Real-time synchronization connected!');
      ws.send(JSON.stringify({
        action: 'join',
        roomId: activeRoom.id,
        userId: currentUser.id,
        userName: currentUser.name
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'seats_changed') {
          setActiveRoom(prev => prev ? { ...prev, seats: data.seats } : null);
          setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, seats: data.seats } : r));
        }

        else if (data.type === 'new_chat_message') {
          setRoomMessages(prev => [
            ...prev,
            {
              sender: data.senderName,
              text: data.text,
              color: data.senderId === currentUser.id ? 'text-amber-400' : 'text-purple-300 font-medium',
              type: 'chat'
            }
          ]);
        }

        else if (data.type === 'system_message') {
          setRoomMessages(prev => [
            ...prev,
            {
              sender: 'نظام المجلس',
              text: data.text,
              color: 'text-purple-400 font-bold',
              type: 'system'
            }
          ]);
        }

        else if (data.type === 'gift_received') {
          spawnFloatingGift(data.gift.icon);
          setRoomMessages(prev => [
            ...prev,
            {
              sender: data.senderName,
              text: `أرسل هدية فاخرة: [ ${data.gift.arabicName} ${data.gift.icon} ] للمجلس! 🌟`,
              color: 'text-amber-400 font-extrabold animate-pulse',
              type: 'chat'
            }
          ]);
          fetchDbStates();
        }

        else if (data.type === 'agent_balance_update') {
          setAgentBalance(data.agentBalance);
          setTransactions(data.transactions);
          if (currentUser.id === data.targetUserId) {
            setCurrentUser(prev => prev ? { ...prev, coins: data.targetUserCoins } : null);
          }
          fetchDbStates();
        }

        else if (data.type === 'audio_stream') {
          playAudioChunk(data.userId, data.audioData);
        }
      } catch (err) {
        console.error('WebSocket parsing error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Real-time synchronization closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeRoom?.id, currentUser?.id]);

  // Voice capture effect
  useEffect(() => {
    if (currentScreen !== 'room' || !activeRoom || !currentUser) {
      stopVoiceCapture();
      return;
    }

    const userSeat = activeRoom.seats.find(s => s.userId === currentUser.id);
    const isMuted = userSeat ? userSeat.isMuted : true;

    if (userSeat && !isMuted) {
      startVoiceCapture();
    } else {
      stopVoiceCapture();
    }

    return () => stopVoiceCapture();
  }, [currentScreen, activeRoom?.seats, currentUser?.id]);

  // Relocated states to the top of the App component to prevent block-scoped reference errors.

  // Architectural Explorer States
  const [selectedFileKey, setSelectedFileKey] = useState<string>('pubspec');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'lib': true,
    'lib/core': true,
    'lib/features': true,
    'lib/features/voice_room': true,
    'lib/features/agent_dashboard': true,
  });
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [activeTab, setActiveTab] = useState<'architecture' | 'code' | 'specs'>('architecture');

  // Interactive Live & Premium State Additions
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [speakingSeatIndex, setSpeakingSeatIndex] = useState<number | null>(null);

  // Native Mobile UI States (Agora RTC status, Bottom sheet draw lists)
  const [isGiftDrawerOpen, setIsGiftDrawerOpen] = useState(false);
  const [isAgoraDrawerOpen, setIsAgoraDrawerOpen] = useState(false);
  const [isNoiseCancellation, setIsNoiseCancellation] = useState(true);
  const [isEchoCancellation, setIsEchoCancellation] = useState(true);
  const [isVoiceConnected, setIsVoiceConnected] = useState(true);
  const [agoraLatency, setAgoraLatency] = useState(21); // ms
  const [agoraPacketLoss, setAgoraPacketLoss] = useState(0.0); // %
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);

  // Dynamic Device Type Detection
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, platform: 'desktop', modelName: 'Desktop' });

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || window.innerWidth < 768;
    
    let modelName = 'جهاز كمبيوتر (Desktop)';
    if (isIOS) {
      if (/iPhone/.test(ua)) {
        modelName = 'آيفون (iPhone)';
      } else if (/iPad/.test(ua)) {
        modelName = 'آيباد (iPad)';
      } else {
        modelName = 'جهاز Apple iOS';
      }
    } else if (isAndroid) {
      if (/Samsung|SM-|SAMSUNG/i.test(ua)) {
        modelName = 'سامسونج (Samsung)';
      } else if (/Huawei|HUAWEI/i.test(ua)) {
        modelName = 'هواوي (Huawei)';
      } else if (/Xiaomi|Redmi|MI/i.test(ua)) {
        modelName = 'شاومي (Xiaomi)';
      } else {
        modelName = 'أندرويد (Android)';
      }
    }

    setDeviceInfo({
      isMobile,
      platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
      modelName
    });
  }, []);
  
  // Interactive Arabic Room Live Chat messages & Input State
  const [chatInputValue, setChatInputValue] = useState('');
  const [roomMessages, setRoomMessages] = useState<Array<{ sender: string; text: string; color?: string; type?: 'chat' | 'system' | 'vip' }>>([
    { sender: 'نظام المجلس', text: 'مرحباً بكم في صدى العرب! يرجى الالتزام بالاحترام المتبادل داخل مجالسنا الموقرة.', color: 'text-purple-400 font-bold', type: 'system' },
    { sender: 'خالد الحربي', text: 'السلام عليكم ورحمة الله، حياكم الله جميعاً بالمجلس الدافئ.', color: 'text-amber-400', type: 'chat' },
  ]);

  // Time Formatter Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12;
      hours = hours ? hours : 12; // 12 hour format
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  // WebRTC Speaking simulation effect
  useEffect(() => {
    if (currentScreen !== 'room' || !activeRoom) {
      setSpeakingSeatIndex(null);
      return;
    }

    const speakerInterval = setInterval(() => {
      // Find indexes of occupied seats
      const occupiedSeatIndexes = activeRoom.seats
        .filter(seat => seat.userId !== null)
        .map(seat => seat.index);

      if (occupiedSeatIndexes.length > 0) {
        // Randomly select one or have none speak (30% silence)
        if (Math.random() > 0.3) {
          const randomIndex = occupiedSeatIndexes[Math.floor(Math.random() * occupiedSeatIndexes.length)];
          setSpeakingSeatIndex(randomIndex);
        } else {
          setSpeakingSeatIndex(null);
        }
      } else {
        setSpeakingSeatIndex(null);
      }
    }, 2800);

    return () => clearInterval(speakerInterval);
  }, [currentScreen, activeRoom]);

  // Dynamic Room Interactive Live Streams simulation
  useEffect(() => {
    if (currentScreen !== 'room' || !activeRoom || !currentUser) return;

    const eventInterval = setInterval(() => {
      const roll = Math.random();
      
      // 1. VIP entrance trigger (30% chance)
      if (roll < 0.3) {
        const vips = [
          { name: 'الشيخ بندر آل سعود', level: 45 },
          { name: 'مريم العتيبي 💎', level: 28 },
          { name: 'أبو تركي الرياض', level: 39 },
          { name: 'سلطان نجد 🔥', level: 50 }
        ];
        const randomVip = vips[Math.floor(Math.random() * vips.length)];
        triggerVipEntrance(randomVip.name, randomVip.level);
      } 
      // 2. Simulated user sends a random gift (40% chance)
      else if (roll < 0.7) {
        // Pick random occupant (someone on the seats, or host)
        const occupiedSeats = activeRoom.seats.filter(s => s.userId !== null && s.userId !== currentUser.id);
        if (occupiedSeats.length > 0) {
          const randomSeat = occupiedSeats[Math.floor(Math.random() * occupiedSeats.length)];
          const randomOccupant = users.find(u => u.id === randomSeat.userId);
          const randomGift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
          
          if (randomOccupant) {
            // Spawn float animation
            spawnFloatingGift(randomGift.icon);
            
            // Log/notify room chat dynamically
            setRoomMessages(prev => [
              ...prev,
              {
                sender: randomOccupant.name,
                text: `أرسل هدية: [ ${randomGift.arabicName} ${randomGift.icon} ] للمجلس 💖`,
                color: 'text-purple-300 font-medium',
                type: 'chat'
              }
            ]);
            
            // Let's increment room XP to show live data stream progression
            const extraXp = randomGift.xpReward;
            setActiveRoom(prev => {
              if (!prev) return null;
              const nextRoomXp = getXpForNextRoomLevel(prev.level);
              let newLvl = prev.level;
              let newXp = prev.xp + extraXp;
              if (newXp >= nextRoomXp) {
                newLvl += 1;
                newXp = newXp - nextRoomXp;
              }
              return { ...prev, level: newLvl, xp: newXp };
            });
          }
        }
      }
    }, 12000);

    return () => clearInterval(eventInterval);
  }, [currentScreen, activeRoom, currentUser, users]);

  // Trigger floating gift animation
  const spawnFloatingGift = (icon: string) => {
    const id = floatingIdCounter.current++;
    // Random position across the center of vertical mobile screen
    const x = 30 + Math.random() * 40; // percentage
    const y = 50 + Math.random() * 20; // percentage
    setFloatingGifts((prev) => [...prev, { id, icon, x, y }]);
    
    // Auto remove after animation completes
    setTimeout(() => {
      setFloatingGifts((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  // Trigger VIP Entrance banner
  const triggerVipEntrance = (userName: string, level: number) => {
    setVipEntrance({ active: true, userName, level });
    // Append VIP Entrance announcement to live chat
    setRoomMessages((prev) => [
      ...prev,
      {
        sender: 'دخول VIP',
        text: `👑 دخل الـ VIP ${userName} (مستوى ${level}) إلى المجلس! حيو الفخم!`,
        color: 'text-amber-300 font-extrabold animate-pulse',
        type: 'vip',
      },
    ]);
    setTimeout(() => {
      setVipEntrance(null);
    }, 4500);
  };

  // Setup initial user levels or auto welcomes
  const handleSignUpAndLogin = async (nameToUse: string) => {
    const finalName = nameToUse.trim() || 'فارس الأصيل';
    // Generate simple stable numeric ID based on name or hash
    const userId = (Math.abs(finalName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 900) + 1000;
    const finalId = userId.toString();

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: finalId,
          name: finalName,
          coins: 10 // 10 coins welcome bonus
        })
      });
      if (response.ok) {
        const loggedUser = await response.json();
        setCurrentUser(loggedUser);
        setCurrentScreen('explore');
        await fetchDbStates();
      }
    } catch (e) {
      console.error('Error during login:', e);
    }

    // Clean input fields
    setCustomName('');
    setPhoneNumber('');
    setSmsOtp('');
    setEmail('');
    setPassword('');
    setShowOtpField(false);
    setLoginMethod(null);
  };

  // Handle entering room
  const handleEnterRoom = (room: VoiceRoom) => {
    if (room.isPrivate) {
      setSelectedLockedRoom(room);
      setRoomPasswordInput('');
      setRoomPasswordError(false);
    } else {
      loadActiveRoom(room);
    }
  };

  const loadActiveRoom = (room: VoiceRoom) => {
    setActiveRoom(room);
    setCurrentScreen('room');
    // Trigger entrance animation for high-level user
    if (currentUser && currentUser.level >= 10) {
      triggerVipEntrance(currentUser.name, currentUser.level);
    }
  };

  const handleVerifyRoomPassword = () => {
    if (selectedLockedRoom) {
      if (roomPasswordInput === selectedLockedRoom.password) {
        const roomToLoad = selectedLockedRoom;
        setSelectedLockedRoom(null);
        loadActiveRoom(roomToLoad);
      } else {
        setRoomPasswordError(true);
      }
    }
  };

  // Seat Management Actions
  const handleSeatClick = (seatIndex: number) => {
    if (!activeRoom || !currentUser) return;
    const seat = activeRoom.seats[seatIndex];

    // If seat is occupied, let host manage it, or let occupant leave
    if (seat.userId) {
      setSelectedSeatIndex(seatIndex);
    } else {
      // Empty seat: If locked, only host can unlock. If open, current user can sit down!
      if (seat.isLocked) {
        if (currentUser.id === activeRoom.seats[0].userId) {
          // Host clicks locked seat -> open sheet to unlock
          setSelectedSeatIndex(seatIndex);
        } else {
          alert('هذا المقعد مغلق ومحجوز من قبل صاحب المجلس!');
        }
      } else {
        // Sit down!
        // First, stand up from any other guest seat they might be on
        const updatedSeats = activeRoom.seats.map((s) => {
          if (s.userId === currentUser.id) {
            return { ...s, userId: null }; // Stand up
          }
          if (s.index === seatIndex) {
            return { ...s, userId: currentUser.id }; // Sit down
          }
          return s;
        });

        const updatedRoom = { ...activeRoom, seats: updatedSeats };
        setActiveRoom(updatedRoom);
        setRooms(rooms.map(r => r.id === activeRoom.id ? updatedRoom : r));

        // Real-time synchronization broadcast
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            action: 'seats_update',
            roomId: activeRoom.id,
            seats: updatedSeats
          }));
        }
      }
    }
  };

  // Perform Host Seat Management operations
  const handleHostAction = (action: 'mute' | 'lock' | 'kick' | 'leave') => {
    if (!activeRoom || selectedSeatIndex === null || !currentUser) return;

    const seat = activeRoom.seats[selectedSeatIndex];
    let updatedSeats = [...activeRoom.seats];

    if (action === 'mute') {
      updatedSeats[selectedSeatIndex] = { ...seat, isMuted: !seat.isMuted };
    } else if (action === 'lock') {
      updatedSeats[selectedSeatIndex] = { ...seat, isLocked: !seat.isLocked, userId: null };
    } else if (action === 'kick') {
      updatedSeats[selectedSeatIndex] = { ...seat, userId: null };
    } else if (action === 'leave') {
      // Current user leaves seat
      if (seat.userId === currentUser.id) {
        updatedSeats[selectedSeatIndex] = { ...seat, userId: null };
      }
    }

    const updatedRoom = { ...activeRoom, seats: updatedSeats };
    setActiveRoom(updatedRoom);
    setRooms(rooms.map(r => r.id === activeRoom.id ? updatedRoom : r));
    setSelectedSeatIndex(null);

    // Real-time synchronization broadcast
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'seats_update',
        roomId: activeRoom.id,
        seats: updatedSeats
      }));
    }
  };

  // Sending virtual premium gifts
  const handleSendGift = (gift: Gift) => {
    if (!currentUser || !activeRoom) return;

    if (currentUser.coins < gift.cost) {
      alert('عذراً! ليس لديك رصيد كافي من الكوينزات لشراء هذه الهدية. يمكنك الشحن عبر الوكيل المعتمد!');
      return;
    }

    // Process via WebSocket to ensure authoritative database deduction and live broadcasting
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'send_gift',
        roomId: activeRoom.id,
        userId: currentUser.id,
        gift
      }));
    }
  };

  const handleSendChatMessage = () => {
    if (!chatInputValue.trim()) return;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'chat_message',
        roomId: activeRoom.id,
        userId: currentUser?.id,
        userName: currentUser?.name,
        text: chatInputValue.trim()
      }));
      setChatInputValue('');
    } else {
      // Local fallback
      setRoomMessages(prev => [
        ...prev,
        {
          sender: currentUser ? currentUser.name : 'مجهول',
          text: chatInputValue.trim(),
          color: 'text-amber-400',
          type: 'chat'
        }
      ]);
      setChatInputValue('');
    }
  };

  // Agent Dashboard logic: User Search
  useEffect(() => {
    if (transferTargetId) {
      const found = users.find(u => u.id === transferTargetId);
      setTransferTargetUser(found || null);
    } else {
      setTransferTargetUser(null);
    }
  }, [transferTargetId, users]);

  // Execute Agent instant coin transfer
  const handleExecuteTransfer = () => {
    setTransferSuccess(false);
    setTransferErrorMsg('');

    if (!transferTargetUser) {
      setTransferErrorMsg('الرجاء إدخال رقم معرف صحيح للعميل والتحقق منه');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferErrorMsg('الرجاء إدخال مبلغ تحويل صحيح أكبر من صفر');
      return;
    }

    if (agentBalance < amount) {
      setTransferErrorMsg('عذراً! رصيدك المتاح كوكيل غير كافٍ لإتمام هذه العملية');
      return;
    }

    if (transferPin !== '9999') {
      setTransferErrorMsg('رمز الأمان PIN غير صحيح! الرجاء إدخال الرمز المعتمد 9999');
      return;
    }

    // Process Transfer on the backend REST API
    fetch('/api/agent/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: transferTargetUser.id,
        amount: amount,
        pin: transferPin
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || 'فشل التحويل'); });
      }
      return res.json();
    })
    .then(async () => {
      setTransferSuccess(true);
      setTransferAmount('');
      setTransferPin('');
      setTransferTargetId('');
      await fetchDbStates(); // Pull fresh database updates
    })
    .catch(err => {
      setTransferErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء إرسال الكوينز');
    });
  };

  // Folder tree toggle
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Copy code to clipboard
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Render directory tree recursively
  const renderFolderTree = (node: FolderNode) => {
    const isExpanded = expandedFolders[node.path];
    const isSelected = selectedFileKey === node.contentKey;

    if (node.type === 'file') {
      return (
        <button
          key={node.path}
          onClick={() => node.contentKey && setSelectedFileKey(node.contentKey)}
          className={`w-full text-left pl-6 pr-2 py-1.5 flex items-center space-x-2 text-sm rounded transition duration-150 ${
            isSelected
              ? 'bg-[#7C3AED]/20 border-l-2 border-[#7C3AED] text-white font-medium'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
          id={`file-node-${node.contentKey}`}
        >
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-mono text-xs truncate">{node.name}</span>
        </button>
      );
    }

    return (
      <div key={node.path} className="mb-1">
        <button
          onClick={() => toggleFolder(node.path)}
          className="w-full text-left px-2 py-1.5 flex items-center space-x-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/40 rounded transition"
          id={`folder-node-${node.path.replace(/\//g, '-')}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-purple-400 flex-shrink-0" />
          )}
          <span className="font-mono text-xs">{node.name}</span>
        </button>

        {isExpanded && node.children && (
          <div className="pl-4 border-l border-slate-800 ml-3 mt-1 space-y-1">
            {node.children.map(child => renderFolderTree(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#03000a] text-slate-200 flex flex-col items-center justify-center p-0 relative overflow-hidden" id="root-container">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main Workspace Layout */}
      <main className="flex flex-col items-center justify-center flex-grow w-full relative z-10" id="main-content">
        
        {/* LEFT COLUMN: Clean Flutter Architecture & Dart Blueprint Explorer (7 Cols) */}
        <div className="hidden" id="blueprint-explorer">
          
          {/* Header Tab Selector */}
          <div className="flex bg-slate-900/90 border-b border-purple-900/30 p-2 justify-between items-center" id="explorer-tabs">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'architecture'
                    ? 'bg-[#7C3AED] text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-architecture"
              >
                <Info className="w-3.5 h-3.5" />
                هيكلية النظام (Architecture)
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'code'
                    ? 'bg-[#7C3AED] text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-code"
              >
                <FileText className="w-3.5 h-3.5" />
                ملفات كود Dart (Blueprints)
              </button>
              <button
                onClick={() => setActiveTab('specs')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'specs'
                    ? 'bg-[#7C3AED] text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-specs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                المواصفات والحلول الفنية
              </button>
            </div>

            {activeTab === 'code' && (
              <button
                onClick={() => handleCopyCode(DART_BLUEPRINTS[selectedFileKey])}
                className="bg-purple-900/50 hover:bg-purple-800 border border-purple-500/30 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 text-purple-300 transition"
                id="copy-code-btn"
              >
                {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedNotification ? 'تم النسخ!' : 'نسخ الكود'}
              </button>
            )}
          </div>

          {/* Tab Contents */}
          <div className="p-4 flex-grow overflow-y-auto" id="explorer-content">
            
            {/* TAB 1: Architecture Explanation */}
            {activeTab === 'architecture' && (
              <div className="space-y-6 text-slate-300" id="arch-tab-panel">
                <div className="bg-gradient-to-r from-purple-950/40 to-slate-900/60 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-300 mb-2">هيكلية Clean Architecture المعتمدة للهواتف الذكية</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تم بناء هذا المخطط الهيكلي للهواتف الذكية (Android & iOS) باتباع نمط <strong className="text-slate-200">Clean Architecture</strong> بالتكامل مع إدارة الحالة <strong className="text-purple-300">BLoC (Business Logic Component)</strong> لضمان فصل منطق العمل عن واجهة المستخدم وقابلية كتابة الاختبارات البرمجية وتوسيع النظام لاحقاً.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-[#C026D3] uppercase tracking-wider block mb-1">1. Presentation Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">تضم واجهات المستخدم (UI Widgets) المكتوبة بـ Flutter ومتحكمات الحالة BLoC التي تستقبل الأحداث وتحدث الشاشة فورياً.</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider block mb-1">2. Domain Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">تحتوي على منطق التطبيق الأساسي (Business Logic)، وحالات الاستخدام (Use Cases) والكيانات الرياضية المطلقة الخالية من أي تبعيات خارجية.</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-1">3. Data Layer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">مسؤولة عن جلب البيانات وتخزينها، وتضم النماذج (Models)، ومصادر البيانات (Data Sources) سواء عبر الإنترنت أو قواعد البيانات المحلية.</p>
                  </div>
                </div>

                {/* State Management Explanation */}
                <div className="border-t border-purple-900/30 pt-4">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    إدارة الحالة باستخدام BLoC & Clean Economy Services
                  </h4>
                  <ul className="text-xs space-y-2.5 text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">●</span>
                      <span><strong className="text-slate-200">SeatManagementBloc</strong>: يدير حالة مقاعد الغرفة الصوتية الـ 9 بدقة (كتم، قفل، طرد، انضمام) ويقوم بإرسال الإشارات فورياً عبر البنية التحتية.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">●</span>
                      <span><strong className="text-slate-200">EconomyService</strong>: نظام الحسابات المغلق والوكلاء، يتعامل مع تحويلات الكوينزات الفورية وإدارتها عبر رمز الحماية الثنائي للوكلاء PIN.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">●</span>
                      <span><strong className="text-slate-200">WebRtcVoiceService</strong>: طبقة تجريد تتيح تبديل محرك الصوت اللاسلكي بسهولة فائقة بين Agora.io و ZegoCloud دون تعديل واجهات التطبيق.</span>
                    </li>
                  </ul>
                </div>

                {/* File Navigator Hint */}
                <div className="bg-purple-950/30 p-3.5 rounded-lg border border-purple-500/25 flex items-center gap-3">
                  <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">
                    تصفح شجرة الملفات بالضغط على علامة <strong className="text-white">"ملفات كود Dart"</strong> بالأعلى لعرض الكود المصدري الكامل لكل ملف ومحتواه المعماري الجاهز للنقل لبيئة العمل الخاصة بك!
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Explorable Tree & Source Code Blueprints */}
            {activeTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full" id="code-tab-panel">
                
                {/* Left Side: Directory Tree Navigator (4 Cols) */}
                <div className="md:col-span-4 border-r border-slate-800/80 pr-2 max-h-[700px] overflow-y-auto">
                  <div className="pb-3 mb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">شجرة ملفات فلاتر الهاتف</span>
                  </div>
                  {renderFolderTree(FLUTTER_FOLDER_STRUCTURE)}
                </div>

                {/* Right Side: Code Viewer (8 Cols) */}
                <div className="md:col-span-8 flex flex-col h-full bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800">
                  <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {selectedFileKey === 'pubspec' ? 'pubspec.yaml' : `lib/.../${selectedFileKey}.dart`}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                      {selectedFileKey === 'pubspec' ? 'yaml' : 'dart'}
                    </span>
                  </div>
                  <pre className="p-4 text-xs font-mono overflow-auto flex-grow max-h-[580px] text-slate-300 bg-[#06040c]">
                    <code>{DART_BLUEPRINTS[selectedFileKey]}</code>
                  </pre>
                </div>

              </div>
            )}

            {/* TAB 3: Tech Specs and Security Design */}
            {activeTab === 'specs' && (
              <div className="space-y-6 text-slate-300" id="specs-tab-panel">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    المواصفات الفنية لحماية وإدارة الغرف (9 مقاعد)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    المقعد رقم 0 هو دائماً مقعد <strong className="text-slate-200">المستضيف أو صاحب الغرفة (Host)</strong>. المقاعد من 1 إلى 8 هي مقاعد الأعضاء والضيوف (Guests).
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-[#C026D3]">● نظام كتم الصوت (Muting Engine)</strong>: يرسل إشعاراً للمقعد المعين لتعطيل المايكرفون محلياً عبر SDK ويقفل حالة الإرسال.
                    </div>
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-[#7C3AED]">● قفل المقاعد (Seat Locking)</strong>: يمكن للمستضيف إغلاق أي مقعد شاغر ليصبح غير متاح للانضمام. يظهر المقعد مغلقاً برمز القفل الأحمر.
                    </div>
                    <div className="p-2.5 bg-[#03000a] rounded border border-slate-800 text-xs">
                      <strong className="text-amber-500">● آلية الطرد الفوري (Kicking)</strong>: عند طرد مستخدم من مقعده يتم تحرير المقعد فورياً وإجبار المستمع المطرود على الرجوع لطبقة الجمهور (Audience).
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-purple-500/20">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    حلول الاقتصاد المغلق ونظام الوكيل الفوري (Agent Dashboard)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    لتجاوز تعقيدات وعمولات متاجر التطبيقات في المراحل الأولى، تم دمج نظام <strong className="text-slate-200">الوكيل المعتمد (Agent Dashboard)</strong> لتمكين عمليات شحن الكوينزات الفورية أوفلاين كاش وتحويلها فورياً عبر معرف المستلم:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-[#03000a] rounded border border-slate-800">
                      <strong className="text-emerald-400 block mb-1">مصادقة هوية المستلم بالمعرف ID</strong>
                      يقوم الوكيل بإدخال معرف العميل المكون من 4 أرقام لتظهر بطاقة العميل الشخصية (الاسم، الصورة، المستوى) للتحقق منها منعاً للأخطاء قبل التحويل.
                    </div>
                    <div className="p-3 bg-[#03000a] rounded border border-slate-800">
                      <strong className="text-amber-400 block mb-1">توثيق رمز الأمان الوكيل PIN</strong>
                      تتطلب العملية إدخال رمز التحقق الشخصي للوكيل المعتمد (PIN) لتوثيق التحويلات وخصمها من الرصيد السحابي الفوري للوكالة.
                    </div>
                  </div>
                </div>

                <div className="bg-purple-950/20 p-4 rounded-xl border border-[#7C3AED]/30">
                  <h3 className="text-xs font-bold text-white mb-1">تكامل WebRTC للاتصال الصوتي فائق السرعة</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تم تضمين واجهة Service المجردة <code className="text-amber-300 font-mono">WebRtcVoiceService</code> للربط مع محركات البث العالمية مثل Agora.io أو ZegoCloud. يتميز هذا التجريد بتمكين التطبيق من إدارة جودة البث الصوتي وتتبع المتحدثين النشطين (Active Speakers) وإدارة جودة الصوت ثلاثي الأبعاد الموجه للمجالس الخليجية والعربية الكبرى.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Info of the Blueprint column */}
          <div className="bg-slate-900 px-4 py-3 border-t border-purple-900/30 flex justify-between items-center text-xs text-slate-400">
            <span>مخطط فلاتر معتمد بواسطة: <strong className="text-slate-200">Senior Mobile App Architect</strong></span>
            <span>صدى العرب v1.0.0</span>
          </div>

        </div>

        {/* RIGHT COLUMN: Full-Screen Responsive App Container (No frames, adapts completely to screen width and native device edges) */}
        <div className="flex flex-col items-center justify-center w-full min-h-screen" id="phone-simulator-container">

          {/* Device Shell - Fully responsive full-screen canvas */}
          <div className="relative w-full min-h-screen bg-[#03000a] flex flex-col font-sans overflow-hidden" id="smartphone-device">
            
            {/* Smartphone Live Screen Content Area */}
            <div className="flex-grow flex flex-col bg-[#03000a] text-slate-100 overflow-hidden relative" id="smartphone-screen">
              
              {/* SCREEN 1: USER AUTHENTICATION SCREEN */}
              {currentScreen === 'login' && (
                <div className="flex-grow flex flex-col p-5 justify-between items-center bg-gradient-to-b from-[#12072b] via-[#03000a] to-[#03000a] h-full" id="screen-login">
                  
                  {/* Brand Branding */}
                  <div className="text-center mt-12">
                    <div 
                      onClick={() => setIsAdminDrawerOpen(true)}
                      className="w-16 h-16 bg-gradient-to-tr from-[#7C3AED] via-[#C026D3] to-amber-400 p-0.5 rounded-2xl shadow-xl shadow-purple-900/50 mx-auto flex items-center justify-center mb-3 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      title="فتح لوحة المطورين والتحكم"
                    >
                      <div className="w-full h-full bg-[#03000a] rounded-[14px] flex items-center justify-center">
                        <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-300">صدى</span>
                      </div>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-white font-sans">تطبيق صدى العرب</h2>
                    <p className="text-[10px] text-slate-400 mt-1">مجالس وغرف دردشة صوتية عربية فاخرة</p>
                  </div>

                  {/* Auth Content */}
                  <div className="w-full space-y-4">
                    {loginMethod === null ? (
                      <div className="space-y-2.5">
                        <div className="text-center mb-3">
                          <span className="text-xs bg-red-950/60 text-red-300 px-3 py-1 rounded-full border border-red-500/30 font-bold inline-block">
                            🚫 يمنع دخول الزوار (لا يوجد حساب ضيف)
                          </span>
                        </div>

                        {/* Interactive Buttons */}
                        <button
                          onClick={() => setLoginMethod('phone')}
                          className="w-full bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                          id="login-btn-phone"
                        >
                          <Phone className="w-4 h-4 text-purple-400" />
                          تسجيل الدخول برقم الهاتف و SMS OTP
                        </button>

                        <button
                          onClick={() => setLoginMethod('email')}
                          className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                          id="login-btn-email"
                        >
                          <Mail className="w-4 h-4 text-slate-400" />
                          تسجيل الدخول بالبريد وكلمة المرور
                        </button>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleSignUpAndLogin('عبدالرحمن الخليجي')}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 py-2 px-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
                            id="login-btn-google"
                          >
                            <span className="text-red-400 font-bold">G</span> Google Sign-In
                          </button>
                          <button
                            onClick={() => handleSignUpAndLogin('بندر الفيصل')}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 py-2 px-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
                            id="login-btn-apple"
                          >
                            <span className="text-white font-bold"></span> Apple ID
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900/90 p-4 rounded-xl border border-purple-500/20 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-white">
                            {loginMethod === 'phone' ? 'تسجيل برقم الهاتف' : 'تسجيل بالبريد الإلكتروني'}
                          </span>
                          <button
                            onClick={() => { setLoginMethod(null); setShowOtpField(false); }}
                            className="text-[10px] text-purple-400 hover:underline"
                            id="login-back-btn"
                          >
                            رجوع
                          </button>
                        </div>

                        {loginMethod === 'phone' && (
                          <div className="space-y-2">
                            {!showOtpField ? (
                              <>
                                <label className="text-[10px] text-slate-400 block text-right">رقم الهاتف الجوال</label>
                                <input
                                  type="tel"
                                  placeholder="966 50 000 0000+"
                                  value={phoneNumber}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white"
                                />
                                <button
                                  onClick={() => {
                                    if (phoneNumber.trim()) {
                                      setShowOtpField(true);
                                      alert('تم إرسال رمز التحقق SMS OTP المكون من 6 أرقام لهاتفك!');
                                    } else {
                                      alert('الرجاء كتابة رقم الهاتف أولاً');
                                    }
                                  }}
                                  className="w-full bg-[#7C3AED] text-white py-2 rounded-lg text-xs font-bold transition"
                                  id="send-otp-btn"
                                >
                                  إرسال رمز التحقق SMS
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="bg-emerald-950/40 text-emerald-300 text-[10px] p-2 rounded text-center border border-emerald-500/20">
                                  تم إرسال رمز التحقق لهاتفك بنجاح
                                </div>
                                <label className="text-[10px] text-slate-400 block text-right">رمز التحقق SMS OTP</label>
                                <input
                                  type="text"
                                  maxLength={6}
                                  placeholder="أدخل رمز التحقق المكون من 6 أرقام"
                                  value={smsOtp}
                                  onChange={(e) => setSmsOtp(e.target.value)}
                                  className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono tracking-widest"
                                />
                                <label className="text-[10px] text-slate-400 block text-right mt-1">الاسم المستعار في المجالس</label>
                                <input
                                  type="text"
                                  placeholder="أدخل اسمك المستعار"
                                  value={customName}
                                  onChange={(e) => setCustomName(e.target.value)}
                                  className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-right text-white"
                                />
                                <button
                                  onClick={() => handleSignUpAndLogin(customName)}
                                  className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold transition"
                                  id="confirm-otp-btn"
                                >
                                  تحقق ودخول المجلس 🔒
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {loginMethod === 'email' && (
                          <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 block text-right">البريد الإلكتروني</label>
                            <input
                              type="email"
                              placeholder="user@sadaarab.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-left text-white"
                            />
                            <label className="text-[10px] text-slate-400 block text-right">كلمة المرور</label>
                            <input
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-left text-white"
                            />
                            <label className="text-[10px] text-slate-400 block text-right">الاسم المستعار</label>
                            <input
                              type="text"
                              placeholder="أدخل اسمك المستعار"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-right text-white"
                            />
                            <button
                              onClick={() => handleSignUpAndLogin(customName)}
                              className="w-full bg-[#7C3AED] text-white py-2 rounded-lg text-xs font-bold transition"
                              id="email-submit-btn"
                            >
                              تسجيل الدخول / إنشاء حساب جديد
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footnote */}
                  <div className="text-center text-[9px] text-slate-500 pb-2 flex flex-col items-center gap-1.5">
                    <span>بالتسجيل أنت توافق على شروط الاستخدام وقوانين المجالس صدى العرب.</span>
                    <span className="text-purple-400 font-bold bg-purple-950/50 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                      <span>📱 تم الكشف التلقائي عن:</span>
                      <span className="text-white">{deviceInfo.modelName}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* SCREEN 2: ROOM EXPLORE LIST SCREEN */}
              {currentScreen === 'explore' && currentUser && (
                <div className="flex-grow flex flex-col h-full bg-[#03000a]" id="screen-explore">
                  
                  {/* Explore Header: Active User profile status */}
                  <div className="bg-gradient-to-b from-[#120c24] to-[#03000a] p-4 border-b border-purple-900/30 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img
                          src={currentUser.avatar}
                          alt="avatar"
                          className="w-10 h-10 rounded-full border-2 border-purple-500 shadow"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[8px] px-1 rounded-full">
                          {currentUser.level}
                        </span>
                      </div>
                      <div className="text-right">
                        <h4 className="text-xs font-bold text-white max-w-[120px] truncate">{currentUser.name}</h4>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-center gap-1 text-[10px] text-amber-300">
                            <Coins className="w-3 h-3 text-amber-400" />
                            <span>🪙 {currentUser.coins.toFixed(0)} كوينز</span>
                          </div>
                          <span className="text-[8px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/25 font-bold tracking-wider flex items-center gap-1">
                            <span>{deviceInfo.platform === 'ios' ? '' : deviceInfo.platform === 'android' ? '🤖' : '💻'}</span>
                            <span>{deviceInfo.modelName}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Agent lock key */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setCurrentScreen('agent_pin')}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2 py-1.5 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all active:scale-95 duration-100 transform cursor-pointer"
                        title="لوحة تحكم الوكيل المعتمد"
                        id="agent-dashboard-gate-btn"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        بوابة الوكيل
                      </button>

                      <button
                        onClick={() => setIsAdminDrawerOpen(true)}
                        className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 p-1.5 rounded-lg text-purple-300 hover:text-purple-200 transition-all active:scale-90 duration-100 transform cursor-pointer"
                        title="لوحة التحكم والمطورين"
                        id="developer-drawer-btn"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => { setCurrentUser(null); setCurrentScreen('login'); }}
                        className="bg-slate-900 hover:bg-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-white transition-all active:scale-90 duration-100 transform cursor-pointer"
                        title="تسجيل الخروج"
                        id="logout-btn"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Explore Body */}
                  <div className="p-4 flex-grow overflow-y-auto space-y-4">
                    
                    {/* Welcome banner with coins check */}
                    <div className="bg-gradient-to-r from-purple-900/40 via-fuchsia-950/20 to-slate-950 p-3 rounded-xl border border-purple-500/20">
                      <div className="flex justify-between items-center">
                        <div className="text-right">
                          <span className="text-[10px] text-amber-300 font-bold block mb-0.5">🎁 هدية ترحيبية نشطة</span>
                          <p className="text-[11px] text-slate-300">تم شحن حسابك بـ <strong className="text-white">10 كوينز مجانية</strong> ترحيباً بك!</p>
                        </div>
                        <Award className="w-8 h-8 text-amber-400 animate-bounce" />
                      </div>
                    </div>

                    {/* Title with Interactive Refresh Action */}
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-400 tracking-wider">الغرف والمجالس الصوتية النشطة</h3>
                      <button
                        onClick={() => {
                          setIsRefreshing(true);
                          setTimeout(() => setIsRefreshing(false), 1200);
                        }}
                        disabled={isRefreshing}
                        className="text-[10px] text-purple-300 hover:text-white flex items-center gap-1.5 bg-purple-950/40 hover:bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-500/20 active:scale-95 transition cursor-pointer"
                        id="refresh-rooms-btn"
                      >
                        <RefreshCw className={`w-3 h-3 text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>تحديث يدوي فوري</span>
                      </button>
                    </div>

                    {/* Rooms List / Shimmer Loader */}
                    {isRefreshing ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="bg-slate-900/40 border border-slate-900/80 p-3.5 rounded-xl flex justify-between items-center animate-pulse">
                            <div className="flex items-center gap-3 w-3/4">
                              <div className="w-11 h-11 rounded-xl animate-shimmer"></div>
                              <div className="space-y-2 flex-grow">
                                <div className="h-3.5 bg-purple-950/80 rounded animate-shimmer w-1/2"></div>
                                <div className="h-2.5 bg-purple-950/40 rounded animate-shimmer w-1/3"></div>
                                <div className="h-2 bg-purple-950/20 rounded animate-shimmer w-1/4"></div>
                              </div>
                            </div>
                            <div className="w-14 h-6 rounded-md bg-purple-950/40 animate-shimmer"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rooms.map((room) => (
                          <div
                            key={room.id}
                            onClick={() => handleEnterRoom(room)}
                            className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 p-3.5 rounded-xl transition duration-150 cursor-pointer flex justify-between items-center active:scale-98 active:bg-slate-900/90 transform"
                            id={`room-item-${room.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={room.hostAvatar}
                                  alt="host avatar"
                                  className="w-11 h-11 rounded-xl object-cover border border-purple-500/30"
                                />
                                {room.isPrivate && (
                                  <div className="absolute -top-1.5 -right-1.5 bg-red-600 p-1 rounded-full border border-slate-950">
                                    <Lock className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <h4 className="text-xs font-extrabold text-white">{room.name}</h4>
                                <p className="text-[9px] text-slate-400 mt-0.5">المستضيف: {room.hostName}</p>
                                <div className="flex gap-1.5 mt-1.5">
                                  <span className="bg-purple-900/50 text-purple-300 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/20 font-bold">
                                    مستوى {room.level}
                                  </span>
                                  {room.isPrivate ? (
                                    <span className="bg-red-950/60 text-red-300 text-[8px] px-1.5 py-0.5 rounded border border-red-500/20 font-bold">
                                      خاص بكلمة سر
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-950/60 text-emerald-300 text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                      عام ومفتوح
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-left">
                              <div className="flex items-center gap-1.5 bg-[#7C3AED]/10 px-2 py-1 rounded-md border border-[#7C3AED]/20">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <span className="text-[10px] font-mono text-purple-300 font-bold">
                                  🔥 {room.activeUsersCount} متواجد
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>

                  {/* Private Room PIN Modal prompt */}
                  {selectedLockedRoom && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50 animate-fade-in">
                      <div className="bg-slate-900 border border-purple-500/30 p-5 rounded-2xl w-full max-w-xs text-right space-y-4">
                        <div className="text-center">
                          <Lock className="w-8 h-8 text-red-500 mx-auto mb-2 animate-bounce" />
                          <h4 className="text-sm font-bold text-white">المجلس محمي بكلمة سر</h4>
                          <p className="text-[10px] text-slate-400 mt-1">يرجى إدخال رمز المرور للدخول للمجلس</p>
                          <span className="text-[9px] text-amber-300 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20 mt-1.5 inline-block">
                            💡 تلميح للمحاكي: الرمز هو 123
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <input
                            type="password"
                            placeholder="رمز الدخول PIN"
                            value={roomPasswordInput}
                            onChange={(e) => {
                              setRoomPasswordInput(e.target.value);
                              setRoomPasswordError(false);
                            }}
                            className="w-full bg-[#03000a] border border-slate-800 rounded-xl p-2.5 text-center text-xs text-white font-mono tracking-widest"
                          />
                          {roomPasswordError && (
                            <span className="text-[9px] text-red-400 text-center block font-bold">رمز الدخول غير صحيح!</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => setSelectedLockedRoom(null)}
                            className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-xs font-bold transition"
                            id="cancel-pin-btn"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={handleVerifyRoomPassword}
                            className="bg-[#7C3AED] hover:bg-[#6d28d9] py-2 rounded-xl text-xs font-bold text-white transition"
                            id="confirm-pin-btn"
                          >
                            تأكيد الدخول
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* SCREEN 3: ACTIVE 9-SEAT VOICE ROOM SCREEN */}
              {currentScreen === 'room' && currentUser && activeRoom && (
                <div className="flex-grow flex flex-col h-full bg-[#05030f] relative overflow-hidden" id="screen-room">
                  
                  {/* Floating Gift Animations rendering container */}
                  <div className="absolute inset-0 pointer-events-none z-30">
                    {floatingGifts.map((gift) => (
                      <div
                        key={gift.id}
                        className="absolute text-4xl animate-bounce"
                        style={{
                          left: `${gift.x}%`,
                          top: `${gift.y}%`,
                          transform: 'translate(-50%, -50%)',
                          animation: 'floatUp 2s ease-out forwards'
                        }}
                      >
                        {gift.icon}
                      </div>
                    ))}

                    <style>{`
                      @keyframes floatUp {
                        0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
                        20% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); }
                        100% { transform: translate(-50%, -160px) scale(0.8); opacity: 0; }
                      }
                      @keyframes chatSlideUp {
                        0% { transform: translateY(18px) scale(0.93); opacity: 0; filter: blur(2px); }
                        100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
                      }
                      .animate-chat-slide-up {
                        animation: chatSlideUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                      }
                    `}</style>
                  </div>

                  {/* VIP Entrance banner element */}
                  {vipEntrance && (
                    <div className="absolute top-24 left-0 right-0 z-40 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-800 p-2 border-y-2 border-amber-400 text-center text-slate-950 font-bold text-xs shadow-xl gold-glow animate-pulse">
                      👑 دخل الـ VIP <span className="underline font-black">{vipEntrance.userName}</span> (مستوى {vipEntrance.level}) المجلس الآن! 👑
                    </div>
                  )}

                  {/* Room Top Header Nav Bar */}
                  <div className="p-3 bg-slate-950/80 border-b border-purple-950/40 flex justify-between items-center select-none">
                    <div className="flex items-center gap-2">
                      <img
                        src={activeRoom.hostAvatar}
                        alt="host"
                        className="w-9 h-9 rounded-lg border border-amber-500/30 object-cover"
                      />
                      <div className="text-right">
                        <h4 className="text-xs font-black text-white max-w-[140px] truncate">{activeRoom.name}</h4>
                        <div className="flex items-center gap-1">
                          <span className="bg-amber-500 text-slate-950 font-black text-[8px] px-1 rounded">
                            مستوى {activeRoom.level}
                          </span>
                          <span className="text-[9px] text-slate-400">المستمعين: {activeRoom.activeUsersCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsAgoraDrawerOpen(true)}
                        className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-[#7C3AED]/20 border border-purple-500/20 text-purple-300 hover:text-white transition cursor-pointer active:scale-95"
                        id="room-settings-btn"
                        title="إعدادات الصوت والمجلس"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          // Make sure to clean seats occupied by current user when leaving
                          const cleanedSeats = activeRoom.seats.map(s => s.userId === currentUser.id ? { ...s, userId: null } : s);
                          const updatedRoom = { ...activeRoom, seats: cleanedSeats };
                          setRooms(rooms.map(r => r.id === activeRoom.id ? updatedRoom : r));
                          setActiveRoom(null);
                          setIsGiftDrawerOpen(false);
                          setIsAgoraDrawerOpen(false);
                          setIsAdminDrawerOpen(false);
                          setSelectedGift(null);
                          setCurrentScreen('explore');
                        }}
                        className="bg-red-950/50 hover:bg-red-900 border border-red-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-300 transition active:scale-95 cursor-pointer"
                        id="exit-room-btn"
                      >
                        خروج
                      </button>
                    </div>
                  </div>

                  {/* Main Content: 9-Seat Interactive Virtual Stage */}
                  <div className="flex-grow p-4 overflow-y-auto flex flex-col justify-between relative pb-24">
                    
                    {/* Level Progress Indicator */}
                    <div className="bg-[#120c24]/80 p-2 rounded-lg border border-purple-500/10 flex justify-between items-center text-[10px] text-slate-400 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span>نقاط الغرفة للتطوير:</span>
                        <span className="font-mono text-purple-300">{activeRoom.xp} / {getXpForNextRoomLevel(activeRoom.level)} XP</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-400 font-bold" title="اتصال مستقر بزمن استجابة فوري">
                        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-mono">متصل</span>
                      </div>
                    </div>

                    {/* 9 SEATS STRUCTURAL MOBILE VIEW */}
                    <div className="space-y-6">
                      
                      {/* Host Seat (Seat 0 - Center Top) */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-amber-400 font-black tracking-widest mb-1">المستضيف / HOST</span>
                        <div
                          onClick={() => handleSeatClick(0)}
                          className={`relative cursor-pointer transition-all duration-300 p-1 rounded-full ${
                            speakingSeatIndex === 0 && activeRoom.seats[0].userId 
                              ? 'animate-voice-pulse border-2 border-amber-400 scale-105 shadow-xl shadow-amber-400/50 ring-2 ring-amber-400/30'
                              : activeRoom.seats[0].userId 
                                ? 'border-2 border-amber-400 shadow-lg shadow-amber-500/20' 
                                : 'border-2 border-dashed border-purple-500/30'
                          }`}
                          id="seat-host"
                        >
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                            {activeRoom.seats[0].userId ? (
                              <img
                                src={users.find(u => u.id === activeRoom.seats[0].userId)?.avatar}
                                alt="host pic"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-7 h-7 text-slate-600" />
                            )}
                          </div>

                          {/* Animated voice speaking indicator */}
                          {speakingSeatIndex === 0 && activeRoom.seats[0].userId && (
                            <div className="absolute -top-1 -right-1 bg-emerald-500 p-1 rounded-full border border-slate-950 animate-green-pulse z-20">
                              <Volume2 className="w-3.5 h-3.5 text-slate-950 font-black" />
                            </div>
                          )}

                          {/* Muted indicator */}
                          {activeRoom.seats[0].isMuted && (
                            <div className="absolute -bottom-1 -left-1 bg-red-600 p-1 rounded-full border border-slate-950">
                              <VolumeX className="w-3 h-3 text-white" />
                            </div>
                          )}

                          {/* Level badge */}
                          {activeRoom.seats[0].userId && ! (speakingSeatIndex === 0) && (
                            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-bold px-1 rounded-full">
                              {users.find(u => u.id === activeRoom.seats[0].userId)?.level}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-white font-bold mt-1 max-w-[100px] truncate">
                          {activeRoom.seats[0].userId ? users.find(u => u.id === activeRoom.seats[0].userId)?.name : 'شاغر'}
                        </span>
                      </div>

                      {/* Guest Seats (Seats 1-8 arranged in an elegant vertical 4x2 Mobile grid) */}
                      <div>
                        <div className="text-center mb-2.5">
                          <span className="text-[9px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                            مقاعد الضيوف والأعضاء (8 مقاعد)
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
                            const seat = activeRoom.seats[index];
                            const occupant = seat.userId ? users.find(u => u.id === seat.userId) : null;

                            return (
                              <div
                                key={index}
                                onClick={() => handleSeatClick(index)}
                                className="flex flex-col items-center cursor-pointer active:scale-95 duration-100 transition transform"
                                id={`seat-guest-${index}`}
                              >
                                <div className={`relative transition-all duration-300 rounded-full p-0.5 ${
                                  speakingSeatIndex === index && occupant
                                    ? 'animate-voice-pulse border-2 border-purple-400 scale-105 shadow-lg shadow-purple-500/50 ring-2 ring-purple-500/30'
                                    : occupant
                                      ? 'border-2 border-purple-500'
                                      : seat.isLocked
                                        ? 'border-2 border-red-500/70'
                                        : 'border border-dashed border-slate-700 hover:border-purple-500/40'
                                }`}>
                                  
                                  {/* Avatar circle */}
                                  <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center">
                                    {occupant ? (
                                      <img
                                        src={occupant.avatar}
                                        alt="guest avatar"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : seat.isLocked ? (
                                      <Lock className="w-4 h-4 text-red-500" />
                                    ) : (
                                      <Plus className="w-4 h-4 text-slate-500" />
                                    )}
                                  </div>

                                  {/* Animated voice speaking indicator */}
                                  {speakingSeatIndex === index && occupant && (
                                    <div className="absolute -top-1 -right-1 bg-emerald-500 p-0.5 rounded-full border border-slate-950 animate-green-pulse z-20">
                                      <Volume2 className="w-2.5 h-2.5 text-slate-950 font-black" />
                                    </div>
                                  )}

                                  {/* Status indicators */}
                                  {seat.isMuted && (
                                    <div className="absolute -bottom-1 -left-1 bg-red-600 p-0.5 rounded-full border border-slate-950">
                                      <VolumeX className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}

                                  {occupant && !(speakingSeatIndex === index) && (
                                    <span className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[7px] font-bold px-1 rounded-full">
                                      {occupant.level}
                                    </span>
                                  )}

                                </div>
                                <span className="text-[10px] text-slate-300 mt-1 max-w-[65px] truncate font-medium text-center">
                                  {occupant ? occupant.name : seat.isLocked ? 'مغلق' : `مقعد ${index}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Live Arabic Council Chat Feed - Premium Floating Transparent Overlay */}
                    <div className="absolute bottom-2 right-4 left-4 h-[110px] pointer-events-none z-20 flex flex-col justify-end overflow-hidden" dir="rtl">
                      <div 
                        ref={(el) => {
                          if (el) {
                            el.scrollTop = el.scrollHeight;
                          }
                        }}
                        className="overflow-y-auto space-y-1.5 scrollbar-none text-right pr-1 flex flex-col justify-end"
                        style={{ 
                          direction: 'rtl', 
                          textAlign: 'right',
                          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                          height: '110px'
                        }}
                      >
                        {roomMessages.map((msg, idx) => (
                          <div key={idx} className="leading-relaxed animate-chat-slide-up">
                            <div className="bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 max-w-[90%] break-words">
                              <span className={`${msg.color || 'text-amber-400'} font-black text-[10px]`}>{msg.sender}:</span>{' '}
                              <span className="text-slate-100 text-[10px] font-medium">{msg.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* NATIVE PHONE NAVIGATION AND BOTTOM ACTION HUB (Standard Real Smartphone UI) */}
                  <div className="p-3 bg-slate-950/95 border-t border-purple-950/40 flex justify-between items-center select-none z-30">
                    
                    {/* 1. Microphones Speak Controller */}
                    <button
                      onClick={() => {
                        // Check if current user is sitting on any seat
                        const userSeatIndex = activeRoom.seats.findIndex(s => s.userId === currentUser.id);
                        if (userSeatIndex === -1) {
                          alert('الرجاء الضغط على أحد المقاعد الشاغرة أولاً لتصعد وتتمكن من التحدث والمشاركة بالصوت!');
                        } else {
                          // Toggle mute
                          const seat = activeRoom.seats[userSeatIndex];
                          const updatedSeats = [...activeRoom.seats];
                          updatedSeats[userSeatIndex] = { ...seat, isMuted: !seat.isMuted };
                          const updatedRoom = { ...activeRoom, seats: updatedSeats };
                          setActiveRoom(updatedRoom);
                          setRooms(rooms.map(r => r.id === activeRoom.id ? updatedRoom : r));
                          
                          // Trigger active voice simulation on enable
                          if (seat.isMuted) {
                            setSpeakingSeatIndex(userSeatIndex);
                            setTimeout(() => setSpeakingSeatIndex(null), 3000);
                          }
                        }
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-all ${
                        activeRoom.seats.some(s => s.userId === currentUser.id)
                          ? activeRoom.seats.find(s => s.userId === currentUser.id)?.isMuted
                            ? 'bg-red-950/40 border border-red-500/40 text-red-300'
                            : 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 animate-pulse'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                      id="mic-speak-btn"
                    >
                      {activeRoom.seats.some(s => s.userId === currentUser.id) && activeRoom.seats.find(s => s.userId === currentUser.id)?.isMuted ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>

                    {/* 2. Interactive Text Input Bar - Designed for Native Smartphone Keyboard */}
                    <div className="flex-grow mx-2 relative flex items-center bg-[#03000a] border border-purple-900/30 hover:border-purple-500/40 focus-within:border-purple-500 rounded-full px-2 py-1.5 transition-all">
                      <input
                        type="text"
                        value={chatInputValue}
                        onChange={(e) => setChatInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSendChatMessage();
                          }
                        }}
                        placeholder="أرسل رسالة للمجلس..."
                        className="flex-grow bg-transparent text-xs px-2 py-0.5 text-slate-100 placeholder-slate-500 text-right outline-none w-full"
                        dir="rtl"
                        id="chat-interactive-input"
                      />
                      <button
                        onClick={handleSendChatMessage}
                        className={`p-1.5 rounded-full text-white transition active:scale-90 cursor-pointer flex items-center justify-center shrink-0 ${
                          chatInputValue.trim() 
                            ? 'bg-purple-600 hover:bg-purple-500' 
                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                        }`}
                        title="إرسال"
                        id="chat-send-btn"
                      >
                        <Send className="w-3.5 h-3.5 transform rotate-180" />
                      </button>
                    </div>

                    {/* 3. Gift Selection Bottom Trigger 🎁 */}
                    <button
                      onClick={() => setIsGiftDrawerOpen(true)}
                      className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 hover:from-amber-500 hover:to-amber-400 flex items-center justify-center shadow-lg hover:shadow-amber-400/20 text-slate-950 cursor-pointer active:scale-90 transition-all text-sm font-bold shrink-0"
                      id="native-gift-trigger"
                    >
                      🎁
                    </button>
                  </div>

                  {/* Seat Actions Modal sheet (when selectedSeatIndex is active) */}
                  {selectedSeatIndex !== null && (
                    <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center animate-fade-in">
                      <div className="bg-[#120c24] border-t border-purple-500/30 p-4 rounded-t-3xl w-full text-right space-y-4 shadow-2xl">
                        
                        <div className="flex justify-between items-center border-b border-purple-950/50 pb-2">
                          <button
                            onClick={() => setSelectedSeatIndex(null)}
                            className="text-xs text-slate-400 hover:text-white"
                            id="close-host-modal-btn"
                          >
                            إغلاق
                          </button>
                          <h4 className="text-xs font-bold text-white">
                            إدارة المقعد رقم {selectedSeatIndex} (المستضيف)
                          </h4>
                        </div>

                        <div className="space-y-2">
                          {/* Mute Seat */}
                          <button
                            onClick={() => handleHostAction('mute')}
                            className="w-full bg-[#03000a] hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl text-xs font-bold text-slate-200 flex justify-between items-center transition"
                            id="host-action-mute"
                          >
                            <span className="text-purple-400">
                              {activeRoom.seats[selectedSeatIndex].isMuted ? 'تفعيل الصوت' : 'كتم الميكروفون'}
                            </span>
                            <Volume2 className="w-4 h-4 text-purple-400" />
                          </button>

                          {/* Lock/Unlock Seat */}
                          <button
                            onClick={() => handleHostAction('lock')}
                            className="w-full bg-[#03000a] hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl text-xs font-bold text-slate-200 flex justify-between items-center transition"
                            id="host-action-lock"
                          >
                            <span className="text-amber-400">
                              {activeRoom.seats[selectedSeatIndex].isLocked ? 'إلغاء قفل المقعد' : 'قفل المقعد وحجبه'}
                            </span>
                            {activeRoom.seats[selectedSeatIndex].isLocked ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
                          </button>

                          {/* Kick Occupant (only visible if seat is occupied) */}
                          {activeRoom.seats[selectedSeatIndex].userId && (
                            <button
                              onClick={() => {
                                if (activeRoom.seats[selectedSeatIndex].userId === currentUser.id) {
                                  handleHostAction('leave');
                                } else {
                                  handleHostAction('kick');
                                }
                              }}
                              className="w-full bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 py-2 px-4 rounded-xl text-xs font-bold text-red-400 flex justify-between items-center transition"
                              id="host-action-kick"
                            >
                              <span>
                                {activeRoom.seats[selectedSeatIndex].userId === currentUser.id ? 'النزول من المقعد للجمهور' : 'طرد المستخدم للجمهور'}
                              </span>
                              <ShieldAlert className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* PURE NATIVE GIFTING BOTTOM SHEET (No Web Simulator Controls) */}
                  {isGiftDrawerOpen && (
                    <div className="absolute inset-x-0 bottom-0 bg-[#0c071fa6] backdrop-blur-xl border-t border-purple-500/30 rounded-t-[32px] p-4 z-50 animate-fade-in shadow-2xl text-right">
                      <div className="flex justify-between items-center border-b border-purple-950/40 pb-2 mb-3">
                        <button
                          onClick={() => setIsGiftDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                          🎁 متجر الهدايا الفاخرة
                        </h4>
                      </div>

                      <div className="flex justify-between items-center bg-[#03000a] p-2 rounded-xl border border-purple-500/10 mb-3">
                        <span className="text-[10px] text-slate-400 font-bold">الرصيد المتوفر:</span>
                        <div className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-mono font-bold text-amber-300">🪙 {currentUser.coins.toFixed(0)} كوينز</span>
                        </div>
                      </div>

                      {/* Gifts Scrollable Grid */}
                      <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto mb-4 p-1 scrollbar-thin">
                        {GIFTS.map((gift) => {
                          const isSelected = selectedGift && selectedGift.id === gift.id;
                          return (
                            <button
                              key={gift.id}
                              onClick={() => setSelectedGift(gift)}
                              className={`p-2.5 rounded-2xl flex flex-col items-center justify-between transition-all duration-150 relative active:scale-95 cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-900/40 border-2 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/20'
                                  : 'bg-[#03000a]/80 border border-purple-900/20 hover:border-purple-500/30'
                              }`}
                            >
                              <span className="text-2xl filter drop-shadow animate-pulse">{gift.icon}</span>
                              <span className="text-[9px] text-slate-100 font-extrabold truncate w-full text-center mt-1.5">{gift.arabicName}</span>
                              <span className="text-[8px] text-amber-300 font-mono mt-0.5 font-bold">🪙 {gift.cost}</span>
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-amber-400 p-0.5 rounded-full">
                                  <Check className="w-2 h-2 text-slate-950 font-black" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Buy Action Buttons */}
                      <div className="flex items-center justify-between gap-2.5 border-t border-purple-950/40 pt-3">
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 block">الهدايا تزيد من مستواك وتدعم المجلس</span>
                          {selectedGift && (
                            <span className="text-[10px] text-purple-300 font-bold block mt-0.5">
                              مكافأة: +{selectedGift.xpReward} نقطة خبرة XP
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (selectedGift) {
                              handleSendGift(selectedGift);
                              spawnFloatingGift(selectedGift.icon);
                            } else {
                              alert('الرجاء اختيار هدية لإرسالها!');
                            }
                          }}
                          className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg cursor-pointer"
                        >
                          إرسال الهدية 🚀
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NATIVE AGORA AUDIO CONNECTION & LATENCY CONFIG DRAWER */}
                  {isAgoraDrawerOpen && (
                    <div className="absolute inset-x-0 bottom-0 bg-[#05030f]/98 backdrop-blur-xl border-t border-purple-500/40 rounded-t-[32px] p-4 z-50 animate-fade-in shadow-2xl text-right font-sans">
                      <div className="flex justify-between items-center border-b border-purple-950/50 pb-2 mb-3">
                        <button
                          onClick={() => setIsAgoraDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                          🎙️ إعدادات محرك الصوت (Agora RTC SFU)
                        </h4>
                      </div>

                      {/* Server Status Header */}
                      <div className="p-3 bg-[#03000a] rounded-xl border border-emerald-500/20 mb-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">حالة خادم الصوت:</span>
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            🟢 متصل عبر Agora SFU 2.0
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">جودة الترميز الصوتي:</span>
                          <span className="text-[10px] text-amber-300 font-mono font-bold">Opus 48kHz Stereo (High Fidelity)</span>
                        </div>
                      </div>

                      {/* Technical latency parameters */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="p-2.5 bg-[#03000a] rounded-lg border border-purple-500/10">
                          <span className="text-[9px] text-slate-400 block mb-0.5">زمن الاستجابة (Latency):</span>
                          <span className="text-xs font-mono font-black text-emerald-400">{agoraLatency}ms (Zero Delay)</span>
                        </div>
                        <div className="p-2.5 bg-[#03000a] rounded-lg border border-purple-500/10">
                          <span className="text-[9px] text-slate-400 block mb-0.5">فقدان حزم البث (Loss):</span>
                          <span className="text-xs font-mono font-black text-slate-300">{agoraPacketLoss.toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Audio Optimization Toggles */}
                      <div className="space-y-2 border-t border-purple-950/40 pt-3 mb-2">
                        <span className="text-[10px] text-slate-400 block mb-1">تعديل جودة بث الغرفة الصوتية:</span>
                        
                        <div className="flex justify-between items-center p-2 bg-[#03000a]/60 rounded-lg">
                          <button
                            onClick={() => setIsEchoCancellation(!isEchoCancellation)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isEchoCancellation 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {isEchoCancellation ? 'مفعّل (Active)' : 'ملغى (Disabled)'}
                          </button>
                          <span className="text-[10px] text-slate-200">إلغاء الصدى الصوتي (Echo Cancellation)</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-[#03000a]/60 rounded-lg">
                          <button
                            onClick={() => setIsNoiseCancellation(!isNoiseCancellation)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isNoiseCancellation 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {isNoiseCancellation ? 'مفعّل (Active)' : 'ملغى (Disabled)'}
                          </button>
                          <span className="text-[10px] text-slate-200">تصفية الضوضاء المحيطية (Noise Suppression)</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-[#03000a]/60 rounded-lg">
                          <button
                            onClick={() => {
                              setIsVoiceConnected(!isVoiceConnected);
                              if (isVoiceConnected) {
                                setSpeakingSeatIndex(null);
                              }
                            }}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isVoiceConnected 
                                ? 'bg-[#7C3AED]/20 text-[#C026D3] border border-purple-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {isVoiceConnected ? 'متصل (Live)' : 'منفصل (Off)'}
                          </button>
                          <span className="text-[10px] text-slate-200">اتصال قناة البث الصوتي (Agora RTC Channel)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADMIN SIMULATION & CONTROL WHEEL DRAWER */}
                  {isAdminDrawerOpen && (
                    <div className="absolute inset-x-0 bottom-0 bg-[#120722]/98 backdrop-blur-xl border-t border-amber-500/30 rounded-t-[32px] p-4 z-50 animate-fade-in shadow-2xl text-right font-sans">
                      <div className="flex justify-between items-center border-b border-purple-950/50 pb-2 mb-3">
                        <button
                          onClick={() => setIsAdminDrawerOpen(false)}
                          className="text-xs text-slate-400 hover:text-white bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 cursor-pointer"
                        >
                          إغلاق
                        </button>
                        <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          👑 أدوات التحكم ومفاتيح المحاكاة
                        </h4>
                      </div>

                      <p className="text-[9px] text-slate-400 mb-3 leading-relaxed">
                        استخدم هذه الأدوات لمحاكاة أحداث البث المباشر الفورية والتحقق من الاستجابة اللحظية (Zero Latency) ومؤشرات التحدث الفعالة.
                      </p>

                      <div className="space-y-2.5">
                        {/* 1. Simulate VIP Entrance */}
                        <button
                          onClick={() => {
                            const vips = ['خالد الحربي', 'الشيخ فيصل الرياض', 'بندر الشمري', 'سعود العتيبي'];
                            const randomVip = vips[Math.floor(Math.random() * vips.length)];
                            triggerVipEntrance(randomVip, 38);
                            setIsAdminDrawerOpen(false);
                          }}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2 px-4 rounded-xl text-xs font-bold flex justify-between items-center transition cursor-pointer active:scale-95"
                        >
                          <span>تشغيل الآن</span>
                          <span className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-slate-950" />
                            محاكاة دخول VIP (مستوى ٣٨) 👑
                          </span>
                        </button>

                        {/* 2. Toggle Speaker voice impulse */}
                        <button
                          onClick={() => {
                            const validIndexes = activeRoom.seats.filter(s => s.userId !== null).map(s => s.index);
                            if (validIndexes.length > 0) {
                              const randomIdx = validIndexes[Math.floor(Math.random() * validIndexes.length)];
                              setSpeakingSeatIndex(randomIdx);
                              setTimeout(() => setSpeakingSeatIndex(null), 2500);
                            }
                            setIsAdminDrawerOpen(false);
                          }}
                          className="w-full bg-[#7C3AED] hover:bg-[#6d28d9] text-white py-2 px-4 rounded-xl text-xs font-bold flex justify-between items-center transition cursor-pointer active:scale-95"
                        >
                          <span>إرسال نبضة صوتية</span>
                          <span className="flex items-center gap-1">
                            <Music className="w-4 h-4 text-white" />
                            محاكاة تحدث المتحدثين (RTC Wave) 🎙️
                          </span>
                        </button>

                        {/* 3. Gift Coin Credit Welcome bonus */}
                        <button
                          onClick={() => {
                            const updatedUser = { ...currentUser, coins: currentUser.coins + 500 };
                            setCurrentUser(updatedUser);
                            setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
                            setIsAdminDrawerOpen(false);
                            alert('تم شحن حسابك بـ 500 كوينز مجانية 🪙 لغرض تجربة إرسال جميع الهدايا الفاخرة!');
                          }}
                          className="w-full bg-[#03000a] hover:bg-slate-900 border border-slate-800 text-amber-300 py-2 px-4 rounded-xl text-xs font-bold flex justify-between items-center transition cursor-pointer active:scale-95"
                        >
                          <span>شحن +500 كوينز</span>
                          <span className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-amber-400" />
                            شحن كوينزات تجريبية فورية
                          </span>
                        </button>

                        {/* 4. Disconnect simulation */}
                        <button
                          onClick={() => {
                            setAgoraLatency(prev => prev === 21 ? 999 : 21);
                            setAgoraPacketLoss(prev => prev === 0.0 ? 82.5 : 0.0);
                            setIsAdminDrawerOpen(false);
                          }}
                          className="w-full bg-[#03000a] hover:bg-slate-900 border border-slate-800 text-red-400 py-2 px-4 rounded-xl text-xs font-bold flex justify-between items-center transition cursor-pointer active:scale-95"
                        >
                          <span>{agoraLatency === 21 ? 'تخريب جودة البث' : 'استعادة استقرار الشبكة'}</span>
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                            محاكاة ضعف الشبكة وفقدان الحزم
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* SCREEN 4: AGENT DASHBOARD SECURITY PIN ENTRY */}
              {currentScreen === 'agent_pin' && (
                <div className="flex-grow flex flex-col p-5 justify-between items-center bg-gradient-to-b from-[#1c120a] to-[#03000a] h-full" id="screen-agent-pin">
                  
                  <div className="text-center mt-12 space-y-2">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
                    <h3 className="text-base font-bold text-white">بوابة الوكلاء المعتمدين</h3>
                    <p className="text-[10px] text-slate-400">الوصول لهذه اللوحة يتطلب صلاحيات وكيل معتمد ورمز أمان</p>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/20 text-right space-y-3">
                      <label className="text-[10px] text-slate-300 block">أدخل رمز أمان الوكيل المعتمد (PIN)</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={agentPinInput}
                        onChange={(e) => {
                          setAgentPinInput(e.target.value);
                          setAgentPinError(false);
                        }}
                        className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2.5 text-center text-xs text-white font-mono tracking-widest"
                      />
                      {agentPinError && (
                        <span className="text-[9px] text-red-400 font-bold block text-center">الرمز غير صحيح! رمز المحاكاة هو: 9999</span>
                      )}
                      <span className="text-[9px] text-amber-400 block text-center">💡 كود المحاكاة المعتمد للوكيل: 9999</span>
                    </div>

                    <button
                      onClick={() => {
                        if (agentPinInput === '9999') {
                          setAgentPinInput('');
                          setCurrentScreen('agent_dashboard');
                        } else {
                          setAgentPinError(true);
                        }
                      }}
                      className="w-full bg-amber-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition"
                      id="agent-pin-submit"
                    >
                      توثيق وفتح لوحة الوكالة 🔒
                    </button>
                  </div>

                  <button
                    onClick={() => setCurrentScreen('explore')}
                    className="text-xs text-slate-400 hover:text-white"
                    id="back-to-explore-from-pin"
                  >
                    إلغاء والعودة للاستكشاف
                  </button>

                </div>
              )}

              {/* SCREEN 5: REAL-TIME AGENT IN-APP DASHBOARD */}
              {currentScreen === 'agent_dashboard' && (
                <div className="flex-grow flex flex-col h-full bg-[#0d0905]" id="screen-agent-dashboard">
                  
                  {/* Agent Header */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-700 p-3 flex justify-between items-center text-slate-950 select-none">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-slate-950" />
                      <div className="text-right">
                        <h4 className="text-xs font-black">الوكيل الذهبي للاتصالات</h4>
                        <p className="text-[8px] opacity-80">صلاحية وكيل رقم #9999</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentScreen('explore')}
                      className="bg-slate-950/25 hover:bg-slate-950/40 text-slate-950 px-2.5 py-1 rounded-lg text-[9px] font-bold transition"
                      id="exit-agent-dashboard-btn"
                    >
                      خروج للغرف
                    </button>
                  </div>

                  {/* Agent Content */}
                  <div className="p-4 flex-grow overflow-y-auto space-y-4">
                    
                    {/* Agent Balance Card */}
                    <div className="bg-gradient-to-br from-purple-950 via-slate-950 to-amber-950/60 p-4 rounded-xl border border-amber-500/30 text-center space-y-1 shadow-md">
                      <span className="text-[10px] text-slate-400">رصيد كوينزات الوكالة الفوري الشاغر:</span>
                      <h3 className="text-2xl font-black text-amber-300 font-mono">
                        🪙 {agentBalance.toLocaleString()}
                      </h3>
                      <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                        رصيد نشط وموثق للتحويل
                      </span>
                    </div>

                    {/* Transfer Module Section */}
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-purple-500/10 space-y-3">
                      <span className="text-[10px] text-amber-400 font-bold block text-right">عملية شحن وتحويل فوري:</span>
                      
                      {/* Search Recipient ID */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-slate-400 block text-right">رقم معرف المستلم (ID)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="مثال: 1001، 1002، 1004"
                            value={transferTargetId}
                            onChange={(e) => setTransferTargetId(e.target.value)}
                            className="flex-grow bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* User recipient verification Card */}
                      {transferTargetUser ? (
                        <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20 flex justify-between items-center animate-fade-in">
                          <div className="flex items-center gap-2">
                            <img
                              src={transferTargetUser.avatar}
                              alt="recipient avatar"
                              className="w-8 h-8 rounded-full border border-emerald-500/30 object-cover"
                            />
                            <div className="text-right">
                              <h5 className="text-[11px] font-bold text-white">{transferTargetUser.name}</h5>
                              <span className="text-[9px] text-amber-300">مستوى {transferTargetUser.level} | 🪙 رصيده الحالي: {transferTargetUser.coins}</span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            مؤكد للهوية ✓
                          </span>
                        </div>
                      ) : (
                        transferTargetId && (
                          <div className="bg-red-950/20 p-2 rounded-lg border border-red-500/20 text-center text-[9px] text-red-400 font-bold">
                            ⚠️ رقم المعرف غير مسجل بقاعدة البيانات!
                          </div>
                        )
                      )}

                      {/* Amount and PIN secure fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 block text-right">عدد الكوينزات</label>
                          <input
                            type="number"
                            placeholder="أدخل عدد الكوينز"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 block text-right">رمز أمان الوكيل PIN</label>
                          <input
                            type="password"
                            placeholder="أدخل PIN الوكيل"
                            value={transferPin}
                            onChange={(e) => setTransferPin(e.target.value)}
                            className="w-full bg-[#03000a] border border-slate-800 rounded-lg p-2 text-xs text-center text-white font-mono"
                          />
                        </div>
                      </div>

                      {transferSuccess && (
                        <div className="bg-emerald-950/40 text-emerald-300 text-[10px] p-2.5 rounded-lg border border-emerald-500/20 text-center font-bold">
                          🎉 تم شحن رصيد العميل بنجاح فورياً!
                        </div>
                      )}

                      {transferErrorMsg && (
                        <div className="bg-red-950/40 text-red-400 text-[10px] p-2 rounded-lg border border-red-500/20 text-center font-bold">
                          ⚠️ {transferErrorMsg}
                        </div>
                      )}

                      <button
                        onClick={handleExecuteTransfer}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                        id="execute-transfer-btn"
                      >
                        <Send className="w-3.5 h-3.5" />
                        إتمام عملية التحويل الفوري
                      </button>

                    </div>

                    {/* Agent Transaction log list */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 block text-right">سجل التحويلات والفواتير الأخيرة للوكالة:</span>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex justify-between items-center text-right text-[10px]"
                          >
                            <div className="text-left">
                              <span className="text-emerald-400 font-mono block">+{tx.amount} 🪙</span>
                              <span className="text-[8px] text-slate-500 block">{new Date(tx.timestamp).toLocaleTimeString('ar-AE')}</span>
                            </div>
                            <div>
                              <strong className="text-white block">{tx.receiverName}</strong>
                              <span className="text-[8px] text-slate-400 block">ID: {tx.receiverId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* Smart Canvas End */}

          </div>

        </div>

      </main>

    </div>
  );
}
