# Wi-Fi Talk — static WebRTC walkie-talkie

A no-backend, no-Node.js, vanilla HTML/CSS/JavaScript prototype for peer-to-peer audio on the same Wi-Fi network.

## What is included

- Push-to-talk mode (hold the large button to transmit; release to stop).
- Full-duplex mode (microphone remains open while connected).
- Host-and-peers topology: the host creates a separate WebRTC peer connection for each joining device.
- Manual WebRTC offer/answer exchange using copy/paste, JSON download, or QR code.
- No STUN/TURN server is configured. The app is intentionally aimed at devices on the same LAN.
- GitHub Pages compatible; no build step.

## Publish on GitHub Pages

1. Create a new GitHub repository, for example `wifi-walkie-talkie`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main`, folder `/ (root)`, and save.
6. Wait for GitHub Pages to publish, then open the HTTPS URL shown there on each device.

The GitHub Pages URL requires internet to download the page and the QR helper libraries. Once the page is loaded, audio is intended to travel directly between devices on the local Wi-Fi. This is not a guarantee that every router/browser combination will establish a local peer connection.

## Connect two devices

1. Connect both devices to the same normal (not guest) Wi-Fi network.
2. Open the GitHub Pages URL on both devices. Grant microphone permission when prompted.
3. On Device A, choose **Create room (host)**, then **Create invitation for a device**.
4. Wait for “Invitation ready”. Share the offer using QR scan, copy/paste, or JSON download.
5. On Device B, choose **Join a room**, paste or scan the offer, then select **Create answer**.
6. Share Device B's answer back to Device A.
7. On Device A, paste the answer and choose **Connect participant**.
8. Wait for the participant status to show `connected`.
9. Select Push to talk and hold the microphone button, or select Two-way audio.

## Add more devices

For every additional device:
1. On the host, click **Create invitation for a device** again.
2. Share that new offer with the next device.
3. The new device creates an answer.
4. Paste that answer into the host's answer box and connect it.

Each participant has a separate peer connection to the host. The host can transmit to all peers. Participants connect to the host, not automatically to one another. A participant's outgoing audio is not automatically forwarded to other participants in this prototype.

## Important browser and network limitations

- Microphone and camera access require a secure context: HTTPS (GitHub Pages provides HTTPS) or localhost.
- Keep the page open while using it. Mobile browsers may suspend audio/network activity when the tab is backgrounded or the screen is locked.
- Apple Watch is not a supported browser target for this web app. A reliable watch experience requires a native watchOS companion.
- The QR helper libraries are loaded from CDNs. If the CDN is unavailable, copy/paste and JSON download still work.
- No STUN/TURN server is configured. This avoids an external media relay and is appropriate for same-LAN testing. Some browsers conceal local IP candidates using mDNS; some router settings or browser combinations can still prevent connection.
- Both devices must be able to communicate with each other on the LAN. Guest Wi-Fi, AP isolation, client isolation, VLAN separation, or firewall rules can block this.
- The app does not include authentication, end-to-end room membership management, or a central signaling service. Treat the offer/answer text as private connection data and share it only with the intended participant.
- Full-duplex mode can cause acoustic feedback if devices are close together. Use headphones.
- Push-to-talk is half-duplex from the user interface perspective. WebRTC connections are bidirectional, but the app only enables microphone transmission while the talk button is held.
- The current version is a functional prototype, not a hardened production communications product.

## Files

- `index.html` — application UI
- `style.css` — responsive styling
- `app.js` — WebRTC, audio, signaling and QR interaction

## Troubleshooting

**Microphone unavailable:** open the HTTPS GitHub Pages URL, grant microphone permission in browser settings, and reload.

**ICE gathering timeout:** verify both devices are on the same Wi-Fi, disable guest/client isolation, and retry. Ensure VPNs are disabled for the test.

**Connected but no sound:** check device volume, speaker toggle, browser audio permission, and microphone permission. Tap the page once to permit audio playback.

**QR scan unavailable:** use copy/paste or JSON download. Camera permission also requires HTTPS.

**One-way audio:** use headphones, confirm the correct device created the answer, and reconnect both peers. Try Push to talk first, then Full-duplex.

**Mobile screen locks and audio stops:** this is a browser/OS lifecycle restriction; keep the app foregrounded. A native app is needed for dependable background walkie-talkie behavior.
