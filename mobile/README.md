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

## Social login (optional)

Sign in / Sign up support **Google**, **Facebook**, and **Apple** (iOS only). To enable:

1. **Backend (web):** Ensure `GOOGLE_CLIENT_ID`, `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`, and `APPLE_CLIENT_ID` are set in `web/.env.local` (same as for the website).
2. **Mobile:** In `mobile/.env`, set:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — same as `GOOGLE_CLIENT_ID` (Google Cloud Console → Web client ID).
   - `EXPO_PUBLIC_FACEBOOK_APP_ID` — same as `FACEBOOK_CLIENT_ID` (Facebook App ID).
3. **Google:** For native builds you’ll need `GoogleService-Info.plist` (iOS) and `google-services.json` (Android); for Expo Go, web client ID is enough if you use it as `webClientId`.
4. **Apple:** Sign in with Apple only appears on iOS 13+; no extra env on mobile.

## Structure

- `app/` — Expo Router screens
- Listings are fetched from the web API
- For full auth, listings CRUD, and payments — use the web app or extend this app with API calls
