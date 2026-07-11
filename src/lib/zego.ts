import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

let zg: ZegoExpressEngine | null = null;

export async function getZegoEngine(): Promise<ZegoExpressEngine> {
  if (!zg) {
    const appId = Number(process.env.ZEGO_APP_ID);
    const serverSecret = process.env.ZEGO_SERVER_SECRET;
    
    if (!appId || !serverSecret) {
      throw new Error('ZEGO_APP_ID and ZEGO_SERVER_SECRET are required');
    }

    // Initialize with engine. The version 3.x uses different constructor parameters potentially,
    // assuming standard initialization here.
    zg = new ZegoExpressEngine(appId, serverSecret);
    
    // Set scenario: VoiceChatRoom is typically 3
    // We'll use the constant if available, otherwise fallback to integer
    try {
        await (zg as any).setScenario(3);
        (zg as any).enableHeadphoneMonitoring(true);
    } catch(e) {
        console.error("Failed to set scenario or enable monitoring", e);
    }
  }
  return zg;
}
