# EriChain Extension — Auditable WhatsApp Web Chats

EriChain is a Chrome/Brave extension that adds auditable, integrity-checked conversations to WhatsApp Web. It does **not** encrypt chats; instead, it builds a signed hashchain so participants can detect deleted, reordered, or tampered messages and export verifiable logs.

## What this extension provides
1. A secure-chat handshake (request/accept/deny/cancel) that establishes a shared seed and public keys.
2. Per-message hashchain with ECDSA signatures (P-256) and HMAC-derived commit keys.
3. Automatic ACKs and verification on incoming messages.
4. Exportable public/private logs at the end of a chat session.
5. A popup UI for chat state and log export.

## Quick start (build and load)
**Requirements:** npm 10.9+ and a Chromium-based browser (Chrome, Brave).

1. `npm install`
2. `npm run build` (outputs to `dist/`)
3. Load the unpacked extension from `dist/` in your browser.

**Dev loop:** `npm run dev` runs Webpack in watch mode and continuously rebuilds `dist/`. Reload the extension with the keyboard shortcut **Ctrl+Shift+E** (macOS: **Command+Shift+E**) after it has been loaded once.

## Usage
1. Open WhatsApp Web.
2. Select a 1:1 chat (this flow is primarily validated for direct chats).
3. Click the secure-chat button inserted near the message composer. A modal appears prompting to request a secure chat.
4. The other party accepts or denies the request from their button set.
5. Once accepted, the chat subtitle shows **Secure Chat Active** and the input box is replaced with an extension-controlled composer.
6. Click the end button to close the session. The extension sends `public_logs_*.json` and `private_logs_*.json` into the chat.

## Protocol overview
### Metadata transport
Metadata is serialized as JSON and attached to the WhatsApp message description (via `linkPreview.description`). Incoming messages read it from `message.description`. This keeps the metadata bound to the message without changing WhatsApp’s UI text.

### Core data structures
**Auditable block (hashchain link)**:
```
{
  hash,
  previousHash,
  counter,
  commitedMessage
}
```

**Auditable metadata**:
```
{
  kind: "AUDITABLE",
  block,
  signature,
  seed?,                 // only on the initial message
  counterpartPublicKey?, // only on the initial message
  initialTimestamp?      // only on the initial message
}
```

**ACK metadata**:
```
{
  kind: "ACK",
  block,
  signature,
  counterpartPublicKey?  // sent on the first ACK to deliver the key
}
```

**Agree-to-Disagree metadata** (used to resolve collisions):
```
{
  kind: "AGREE_TO_DISAGREE",
  block: { hash, previousData, counter },
  disagreeRoot,
  signature
}
```

### Hashchain and signatures
1. A per-chat seed is derived from `{chatId, userId, time}` and stored in the chat state.
2. For each counter `n`, the commit key is `HMAC(seed, n)`.
3. The committed message is `SHA-256({ commitedKey, message })`.
4. The block hash is `SHA-256({ previousHash, counter, commitedMessage })`.
5. Each block is signed with ECDSA P-256.

### Control messages
The extension uses explicit control messages to drive the handshake and lifecycle:
- `REQUEST` → request secure chat
- `ACCEPT`/`DENY`/`CANCEL` → handshake response
- `END` → finish the chat and export logs
- `ABORT` → terminate the chat on invalid data
- `ACK` → verification acknowledgement
- `AGREE_TO_DISAGREE_*` → collision resolution flow

### Collision handling (Agree-to-Disagree)
If both participants send messages concurrently while waiting for ACKs, the state machine triggers an **Agree-to-Disagree (AtD)** protocol:
1. It collects recent auditable messages to find the collision root.
2. It verifies the chain up to that root.
3. It assembles an AtD block with both sides’ last valid hashes.
4. Both sides exchange AtD attempts until a resolve is reached, then clean up extra AtD messages.

## Architecture
**`src/injected_api.ts` (MAIN world)**  
Runs inside WhatsApp Web’s page context. Subscribes to `@wppconnect/wa-js` events and posts messages to the content script.

**`src/front.ts` (content script)**  
Owns UI changes and the secure-chat button flow. Replaces the input box during secure chats and forwards events to the background service worker.

**`src/background.ts` (service worker)**  
Maintains chat state, generates keys on install, signs/verifies blocks, and mediates all message sending/receiving.

**`src/default_popup.ts` (extension popup)**  
Shows chat states, lets you delete stored chats, and exports logs from IndexedDB.

## Storage and logs
1. **Chat state**: `chrome.storage.local` under the `chats` key.
2. **User identifier**: `chrome.storage.local` under `userId`.
3. **Asymmetric keys**: `chrome.storage.local` keys `PRIVATE_KEY` and `PUBLIC_KEY` (generated at install).
4. **Logs**: IndexedDB database `ExtensionLogs`, exported as CSV from the popup.

**End-of-chat exports:**
- `public_logs_*.json` — hashchain blocks + public keys + last signatures
- `private_logs_*.json` — committed keys + message content (used to verify commitments)

## Configuration
- **Log level** is compiled in via Webpack: `DEBUG` in development, `INFO` in production (`webpack.config.js`).
- **Reload shortcut** is defined in `public/manifest.json` (Ctrl+Shift+E / Command+Shift+E).

## Scripts
1. `npm run dev` — Webpack watch build
2. `npm run build` — production build
3. `npm run test` — placeholder script (not configured)

## Repository layout
| Path | Purpose |
| --- | --- |
| `src/` | Extension source (content scripts, background, crypto, state machine) |
| `public/` | Manifest, popup UI, icons (copied to `dist/`) |
| `benchmarks/` | Data-collection scripts and plots |
| `dist/` | Webpack build output (load this as the extension) |

## Benchmarks and analysis
The `benchmarks/` folder includes:
1. `data_collection.js` — a Tampermonkey userscript that collects timing and WebSocket memory data.
2. `collection_methodology.md` — methodology notes (Portuguese).
3. `generate_plots.ipynb` — plotting notebook.

Python dependencies for benchmark analysis live in `pyproject.toml` and are **not** required to build or run the extension.

## Known issues (from existing backlog)
1. Accepting a secure-chat request in the wrong chat can succeed.
2. If the UI freezes while switching chats, duplicate secure-chat buttons can appear.

## License
MIT — see `LICENSE`.
