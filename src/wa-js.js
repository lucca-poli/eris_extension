import WPP from "@wppconnect/wa-js"

/** @type {typeof WPP} */
const WhatsappLayer = window.WPP;

function waitUserLogging(timeout = 30000) {
    const startTime = Date.now();
    const interval = setInterval(() => {
        if (WhatsappLayer.isFullReady) {
            //clearInterval(interval);
            window.postMessage({ type: 'WPP_FULLY_READY', intervalId: interval }, '*');
        } else if (Date.now() - startTime > timeout) {
            //clearInterval(interval);
            console.log("Login time has timed out!");
        }
    }, 1000);
}
