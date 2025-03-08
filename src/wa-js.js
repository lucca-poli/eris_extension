import WPP from "@wppconnect/wa-js"

/** @type {typeof WPP} */
const WhatsappLayer = window.WPP;

function wpp_init() {
    console.log('WPP is loaded:', WhatsappLayer);
    window.postMessage({ type: 'WA_JS_READY' }, '*');
}

wpp_init();
