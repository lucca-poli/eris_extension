import WPP from "@wppconnect/wa-js"

function waitForWPP(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            if (Object.keys(window.WPP).length !== 0) {
                clearInterval(interval);
                resolve(window.WPP);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error('WPP did not load within the timeout'));
            }
        }, 200); // Check every 100ms
    });
}

async function main() {
    try {
        await waitForWPP();
        console.log('WPP is loaded:', window.WPP);
    } catch (error) {
        console.error(error.message);
    }
}

main();
