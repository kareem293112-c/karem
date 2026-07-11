export * from './events';
export * from './engine';
export * from './publisher';
export * from './player';
export * from './roomController';

// الحل النهائي: إيقاظ محرك الصوت إجبارياً فور أول تفاعل للمستخدم مع التطبيق
if (typeof window !== 'undefined') {
    const wakeupAudio = async () => {
        try {
            const { ZegoEngineManager } = await import('./engine');
            const manager = ZegoEngineManager.getInstance();
            
            // استدعاء محرك الصوت الرئيسي لتنشيطه فوراً
            manager.getEngine().then(() => {
                console.log("[ZEGO-GLOBAL] Audio Context triggered via User Interaction.");
            });
            
            // إزالة المستمع بعد التنشيط الأول لعدم تكرار استهلاك الموارد
            window.removeEventListener('click', wakeupAudio);
            window.removeEventListener('touchstart', wakeupAudio);
        } catch (e) {
            console.error("[ZEGO-GLOBAL] Error waking up audio context:", e);
        }
    };

    // الاستماع لأول نقرة أو لمسة على الهواتف والآيفون
    window.addEventListener('click', wakeupAudio, { once: true });
    window.addEventListener('touchstart', wakeupAudio, { once: true });
}
