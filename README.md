# Erichain - Hashchains for messages integrity. Whatsapp implementation.

# How to use

## Requirements
1. Have npm installed with version 10.9 or higher.

## Procedure

1. Clone this repo.
2. Run ```npm install```.
3. Run ```npm run build```. This should build the project in a /dist directory.
4. In your target browser (e.g. Google Chrome or Brave), run the extension in development mode. [This tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) should explain well enough, the target directory is the /dist generated in the previous step.

If you want to tweak the code a bit, run ```npm run dev``` and every time you save it compiles a new /dist. To reload the new extension again in the browser press Ctrl+E, you can only reload this way after loading for the first time.

If you want to test the 1x1 chat, try running 2 different browsers and loading the same compiled /dist for both of them.

# Refinement Pool
- AtD block
- Signatures

# Bugs
- Sending 2 messages too fast causes a bug.
