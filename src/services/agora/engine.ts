import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { fetch } from '../../lib/utils';

export class AgoraEngineManager {
    private static instance: AgoraEngineManager | null = null;
    private client: IAgoraRTCClient | null = null;
    private localAudioTrack: IMicrophoneAudioTrack | null = null;
    public isPublishing = false;
    private volumeCallback: ((volumes: { uid: string; level: number }[]) => void) | null = null;

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
            
            // Get token from server
            const response = await fetch(`/api/agora-token?channelName=${roomID}&account=${userID}`);
            const { token } = await response.json();
            
            console.log(`[AGORA] Attempting to join room with App ID: ${appId} and token: ${token.substring(0, 5)}...`);
            
            await client.join(appId, roomID, token, userID);
            console.log(`[AGORA] Successfully joined room: ${roomID} as User: ${userID}`);
        } catch (err) {
            console.error("[AGORA] Join room failed:", err);
        }
    }

    public async startPublishing() {
        if (this.isPublishing) return;

        try {
            const client = await this.initEngine();
            if (!client) return;

            console.log("[AGORA] Creating High-Quality microphone track...");
            this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                encoderConfig: {
                    sampleRate: 48000, // 48kHz عالية الجودة
                    stereo: true,      // منع كتم الصوت تلقائياً
                    bitrate: 128,      // تدفق سريع لمنع التقطيع
                },
                AEC: true, // إلغاء صدى الصوت النشط في الهواتف والآيفون
                AGC: true, // التحكم التلقائي في مستويات المايك
                ANS: true, // حجب الضوضاء الخلفية
            });

            await client.publish(this.localAudioTrack);
            this.isPublishing = true;
            console.log("[AGORA] Microphone published successfully and broadcasting!");
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
                console.log("[AGORA] Successfully left the audio room.");
            }
        } catch (err) {
            console.error("[AGORA] Error leaving room:", err);
        }
    }
}
