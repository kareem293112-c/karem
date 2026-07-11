import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

let zg: ZegoExpressEngine | null = null;

export async function getZegoEngine(): Promise<ZegoExpressEngine | null> {
  if (!zg) {
    const appId = Number(process.env.ZEGO_APP_ID);
    const appSign = process.env.ZEGO_APP_SIGN;
    
    if (!appId || !appSign) {
      console.warn('ZEGO_APP_ID and ZEGO_APP_SIGN are not set. Zego sound features will be disabled.');
      return null;
    }

    // Initialize with engine.
    zg = new ZegoExpressEngine(appId, appSign);
    
    // Set scenario: VoiceChatRoom is typically 3
    try {
        await (zg as any).setScenario(3);
        (zg as any).enableHeadphoneMonitoring(true);
    } catch(e) {
        console.error("Failed to set scenario or enable monitoring", e);
    }
  }
  return zg;
}
