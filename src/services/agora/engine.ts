import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { fetch } from '../../lib/utils';

export class AgoraEngineManager {
    private static instance: AgoraEngineManager | null = null;
    private client: IAgoraRTCClient | null = null;
    private localAudioTrack: IMicrophoneAudioTrack | null = null;
    public isPublishing = false;
    private volumeCallback: ((volumes: { uid: string; level: number }[]) => void) | null = null;
    // 1. إضافة متغير لمتابعة حالة الانضمام الفعلية
    private isJoined = false;

    private constructor() {}

    public static getInstance(): AgoraEngineManager {
        if (!AgoraEngineManager.instance) {
            AgoraEngineManager.instance = new AgoraEngineManager();
        }
        return AgoraEngineManager.instance;
    }

    public onVolumeIndicator(callback: (volumes: { uid: string; level: number }[]) => void) {
        this.volumeCallback = callback;
    }

    public async initEngine(): Promise<IAgoraRTCClient | null> {
        if (this.client) return this.client;

        try {
            // إنشاء كائن الاتصال الجماعي لغرف الصوت
            this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            console.log("[AGORA] Engine initialized successfully.");

            // تفعيل مؤشرات الصوت وتتبع المتحدث النشط
            this.client.enableAudioVolumeIndicator();
            this.client.on('volume-indicator', (volumes) => {
                if (this.volumeCallback) {
                    this.volumeCallback(volumes.map(v => ({ uid: String(v.uid), level: v.level })));
                }
            });
            
            // الاستماع التلقائي لأصوات الأعضاء الآخرين وتشغيلها فوراً وبأعلى جودة
            this.client.on('user-published', async (user, mediaType) => {
                if (mediaType === 'audio') {
                    console.log("[AGORA] New remote audio stream detected from user:", user.uid);
                    await this.client!.subscribe(user, mediaType);
                    if (user.audioTrack) {
                        user.audioTrack.play(); // تشغيل الصوت تلقائياً
                    }
                }
            });

            this.client.on('user-unpublished', async (user, mediaType) => {
                if (mediaType === 'audio') {
                    console.log("[AGORA] Remote user stopped audio:", user.uid);
                }
            });

            return this.client;
        } catch (err) {
            console.error("[AGORA] Failed to init Agora:", err);
            return null;
        }
    }

    public async joinAudioRoom(roomID: string, userID: string) {
        try {
            const client = await this.initEngine();
            if (!client) throw new Error("Agora client not initialized");

            const appId = import.meta.env.VITE_AGORA_APP_ID || "c7dfa22636da4b40980825480e3c090c";
            
            // جلب التوكن ديناميكياً من السيرفر
            const response = await fetch(`/api/agora-token?channelName=${roomID}&account=${userID}`);
            const { token } = await response.json();
            
            await client.join(appId, roomID, token, userID);
            this.isJoined = true; // تأكيد نجاح الانضمام
            console.log(`[AGORA] Successfully joined room: ${roomID}`);
        } catch (err) {
            this.isJoined = false;
            console.error("[AGORA] Join room failed:", err);
        }
    }

    public async startPublishing() {
        if (this.isPublishing) return;

        // الحماية الحاسمة: الانتظار حتى يكتمل الانضمام بنجاح
        if (!this.isJoined) {
            console.warn("[AGORA-GUARD] Waiting for join connection to establish...");
            // محاولة انتظام صغيرة أو تأخير لثوانٍ معدودة لإتاحة الفرصة للسوكت ليفتح
            await new Promise(resolve => setTimeout(resolve, 800)); 
            if (!this.isJoined) {
                console.error("[AGORA-GUARD] Cannot publish, user still hasn't joined the room.");
                return;
            }
        }

        try {
            const client = await this.initEngine();
            if (!client) return;

            if (!this.localAudioTrack) {
                console.log("[AGORA] Creating High-Quality microphone track...");
                this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                    encoderConfig: { sampleRate: 48000, stereo: true, bitrate: 128 },
                    AEC: true, AGC: true, ANS: true
                });
            }

            await client.publish(this.localAudioTrack);
            this.isPublishing = true;
            console.log("[AGORA] Microphone published successfully!");
        } catch (err) {
            console.error("[AGORA] Failed to publish microphone:", err);
        }
    }

    public async stopPublishing() {
        if (!this.isPublishing || !this.client) return;

        try {
            if (this.localAudioTrack) {
                await this.client.unpublish(this.localAudioTrack);
                this.localAudioTrack.stop();
                this.localAudioTrack.close();
                this.localAudioTrack = null;
            }
            this.isPublishing = false;
            console.log("[AGORA] Microphone unpublished successfully.");
        } catch (err) {
            console.error("[AGORA] Error stopping publish:", err);
        }
    }

    public async leaveAudioRoom() {
        try {
            await this.stopPublishing();
            if (this.client) {
                await this.client.leave();
                this.isJoined = false; // إعادة ضبط الحالة عند المغادرة
                console.log("[AGORA] Successfully left the audio room.");
            }
        } catch (err) {
            console.error("[AGORA] Error leaving room:", err);
        }
    }
}
