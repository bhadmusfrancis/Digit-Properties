# Digit Properties — Mobile App (Expo)

React Native / Expo app for Digit Properties. Connects to the web API for listings.

## Setup

1. Install dependencies: `npm install`
2. Set `EXPO_PUBLIC_API_URL` in `.env` (e.g. `https://digitproperties.com` or `http://YOUR_IP:3000` for local)
3. Run: `npx expo start`

## Testing on Expo Go

Expo Go lets you run the app on your phone without building a native binary.

1. **Install Expo Go** on your device:
   - [Android – Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS – App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Start the dev server** from the `mobile` folder:
   ```bash
   cd mobile
   npx expo start
   ```

3. **Open the app on your device:**
   - **Same Wi‑Fi:** Ensure your phone and computer are on the same Wi‑Fi. In the terminal (or in the browser at `http://localhost:8081`), scan the **QR code** with:
     - **Android:** Expo Go app (or Camera app; it will offer to open in Expo Go).
     - **iOS:** Camera app; tap the banner to open in Expo Go.
   - **Tunnel (different network):** Press `s` in the terminal to switch to tunnel mode, then scan the new QR code. Slower but works when phone and PC are on different networks.

4. **Point the app at your backend:**
   - For a **local web API**, use your machine’s LAN IP in `mobile/.env`, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.100:3000`. Use that same IP in the browser on your phone if you open the web app.
   - For a **deployed API**, set `EXPO_PUBLIC_API_URL=https://your-domain.com`.

5. **Hot reload:** Shake the device (or press `r` in the terminal) to reload. Logs appear in the terminal.

## Structure

- `app/` — Expo Router screens
- Listings are fetched from the web API
- For full auth, listings CRUD, and payments — use the web app or extend this app with API calls
