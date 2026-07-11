import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

export class ZegoEngineManager {
    private static instance: ZegoEngineManager | null = null;
    private zg: ZegoExpressEngine | null = null;
    private localStreams: Map<string, any> = new Map();
    private audioCtx: AudioContext | null = null;
    public state: 'Disconnected' | 'Connecting' | 'Connected' | 'Publishing' = 'Disconnected';

    private constructor() {}

    public static getInstance(): ZegoEngineManager {
        if (!ZegoEngineManager.instance) {
            ZegoEngineManager.instance = new ZegoEngineManager();
        }
        return ZegoEngineManager.instance;
    }

    private initAudioContext() {
        if (typeof window === 'undefined') return;
        try {
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    this.audioCtx = new AudioContextClass();
                    console.log("[ZEGO] Global AudioContext created. State:", this.audioCtx?.state);
                }
            }

            if (this.zg && this.audioCtx) {
                (this.zg as any).audioContext = this.audioCtx;
            }

            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    console.log("[ZEGO] Global AudioContext resumed successfully.");
                }).catch((err) => {
                    console.warn("[ZEGO] Failed to resume AudioContext:", err);
                });
            }
        } catch (e) {
            console.error("[ZEGO] Error in initAudioContext:", e);
        }
    }

    public async getEngine(): Promise<ZegoExpressEngine | null> {
        if (this.zg) return this.zg;

        this.state = 'Connecting';
        let appId = Number(import.meta.env.VITE_ZEGO_APP_ID);
        let appSign = import.meta.env.VITE_ZEGO_APP_SIGN;

        if (!appId || !appSign) {
            console.error("[ZEGO] APP_ID or APP_SIGN is missing in environment variables!");
            this.state = 'Disconnected';
            return null;
        }

        try {
            const serverUrl = `wss://webliveroom${appId}://zegocloud.com`;
            this.zg = new ZegoExpressEngine(appId, serverUrl);
            this.state = 'Connected';
            console.log("[ZEGO] Engine initialized successfully.");

            this.initAudioContext();
            this.setupEngineEvents(); 

            return this.zg;
        } catch (error) {
            console.error("[ZEGO] Engine initialization failed:", error);
            this.state = 'Disconnected';
            return null;
        }
    }

    private setupEngineEvents() {
        if (!this.zg) return;

        this.zg.on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: any[]) => {
            console.log(`[ZEGO] roomStreamUpdate trigger: ${updateType}`, streamList);
            
            if (updateType === 'ADD') {
                for (let i = 0; i < streamList.length; i++) {
                    const remoteStreamID = streamList[i].streamID;
                    
                    if (this.localStreams.has(remoteStreamID)) continue;

                    console.log("[ZEGO] Remote user active. Streaming voice from ID:", remoteStreamID);
                    
                    try {
                        const remoteStream = await this.zg!.startPlayingStream(remoteStreamID);
                        
                        let remoteAudio = document.getElementById(`audio_${remoteStreamID}`) as HTMLAudioElement;
                        if (!remoteAudio) {
                            remoteAudio = document.createElement('audio');
                            remoteAudio.id = `audio_${remoteStreamID}`;
                            remoteAudio.autoplay = true;
                            remoteAudio.setAttribute('playsinline', 'true'); 
                            document.body.appendChild(remoteAudio);
                        }
                        remoteAudio.srcObject = remoteStream;

                        if (this.audioCtx && this.audioCtx.state === 'suspended') {
                            await this.audioCtx.resume();
                        }
                    } catch (playError) {
                        console.error("[ZEGO] Error playing remote stream:", playError);
                    }
                }
            } else if (updateType === 'DELETE') {
                for (let i = 0; i < streamList.length; i++) {
                    const remoteStreamID = streamList[i].streamID;
                    console.log("[ZEGO] Remote user left, destroying dynamic audio element:", remoteStreamID);
                    try {
                        this.zg!.stopPlayingStream(remoteStreamID);
                    } catch (e) {}
                    const remoteAudio = document.getElementById(`audio_${remoteStreamID}`);
                    if (remoteAudio) remoteAudio.remove();
                }
            }
        });
    }

    public async startPublishing(streamID: string) {
        if (this.localStreams.has(streamID)) {
            console.log("[ZEGO] Already publishing stream:", streamID);
            return;
        }

        try {
            const engine = await this.getEngine();
            if (!engine) throw new Error("Zego Engine not initialized");

            this.initAudioContext(); 

            console.log("[ZEGO] Creating local audio-only stream for:", streamID);
            const localStream = await engine.createStream({
                camera: {
                    audio: true,
                    video: false,
                }
            });

            console.log("[ZEGO] Starting stream publishing:", streamID);
            await engine.startPublishingStream(streamID, localStream);
            this.localStreams.set(streamID, localStream);
            this.state = 'Publishing';
            console.log("[ZEGO] Publish stream success!", streamID);

        } catch (err) {
            console.error("[ZEGO] Failed to start publishing:", err);
        }
    }

    public async stopPublishing(streamID: string) {
        // حماية لمنع الواجهة من فصل الصوت تلقائياً أثناء الجلوس على المقعد
        if (this.state === 'Publishing' && this.localStreams.has(streamID)) {
            console.log("[ZEGO-GUARD] Preventing accidental microphone shutdown for stream:", streamID);
            return; 
        }

        const engine = await this.getEngine();
        if (engine) {
            try {
                console.log("[ZEGO] Stopping stream publishing:", streamID);
                await engine.stopPublishingStream(streamID);
                const localStream = this.localStreams.get(streamID);
                if (localStream) {
                    await engine.destroyStream(localStream);
                    this.localStreams.delete(streamID);
                }
                this.state = 'Connected';
                console.log("[ZEGO] Stop publishing stream success!", streamID);
            } catch (err) {
                console.error("[ZEGO] Failed to stop publishing:", err);
            }
        }
    }
}
