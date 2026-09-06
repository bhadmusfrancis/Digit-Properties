# Digit Properties — Mobile app

React Native / Expo app for [digitproperties.com](https://www.digitproperties.com). Same listings API as the web app. Navigation follows familiar real-estate apps (Explore, Search, Saved, Account).

## Run locally

```bash
cd mobile
npm install
npx expo start
```

Then open in Expo Go, an Android emulator, or an iOS simulator.

Copy `.env.example` to `.env` if you need Google / Facebook sign-in keys.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | API origin (default `https://www.digitproperties.com`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Shows Google button; same value as web `GOOGLE_CLIENT_ID` |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Shows Facebook button; same value as web `FACEBOOK_CLIENT_ID` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps on Android (native builds) |

Mobile Google/Facebook sign-in uses an HTTPS bridge on the website (`/api/auth/mobile-oauth/*`). In Google Cloud and Meta developer consoles, add this redirect URI:

`https://www.digitproperties.com/api/auth/mobile-oauth/callback`

(also add the non-www host if you use `NEXTAUTH_URL=https://digitproperties.com`).

Apple Sign-In is available on iOS 13+ without extra env vars.

## Store identifiers

- **iOS bundle ID:** `com.digitproperties.app`
- **Android package:** `com.digitproperties.app`
- **Privacy Policy:** https://www.digitproperties.com/privacy
- **Terms:** https://www.digitproperties.com/terms
- **Account deletion:** in-app at Account → Delete account (App Store 5.1.1(v))

## Production builds (EAS)

1. Install EAS CLI: `npm i -g eas-cli` and run `eas login`.
2. From `mobile/`: `eas init` (creates the Expo project and writes `extra.eas.projectId` into `app.json`).
3. Android Play Store (AAB):

   ```bash
   eas build --platform android --profile production
   ```

4. iOS App Store:

   ```bash
   eas build --platform ios --profile production
   ```

5. Submit drafts:

   ```bash
   eas submit --platform android --profile production
   eas submit --platform ios --profile production
   ```

Preview APK for testers: `eas build --platform android --profile preview`.

## Over-the-air updates (EAS Update)

JS/UI changes (screens, copy, API wiring) can ship without a store review. Native changes (new permissions, splash, native modules) still need a new EAS build.

Publish from `mobile/`:

```bash
npx eas-cli update --channel production --message "Describe the change"
```

Or `npm run update:production -- --message "Describe the change"`. Testers on preview builds: `npm run update:preview -- --message "…"`.

- Channel must match the EAS build profile (`production`, `preview`, or `development`).
- `runtimeVersion` is `1.0.0`. Keep it the same until you ship a native binary that bumps it.
- Store builds that were compiled with updates **disabled** will not fetch OTA until you ship one new Play/App Store binary with this config, then later JS releases can be OTA-only.

If EAS warns that `android/` is present and will not sync `app.json`, run `npx expo prebuild --clean` once so Play/App Store binaries pick up icons, splash, and permission strings from `app.json`.

### App Store Connect checklist

- Privacy policy URL (hosted page above)
- Apple Sign-In capability (already enabled in `app.json`)
- In-app account deletion
- Encryption: `ITSAppUsesNonExemptEncryption` is `false` (standard HTTPS only)
- Screenshots: 6.7" and 6.1" iPhone, plus iPad if you keep `supportsTablet`
- Age rating: typically 4+ unless you enable user-generated chat

### Play Console checklist

- Upload the **AAB** from the production profile (not the preview APK)
- Data safety form: account data, location (optional, listing pin), photos (listing upload)
- Privacy policy URL
- Feature graphic 1024×500 and phone screenshots
- Content rating questionnaire

Bump `expo.version` in `app.json` for each store release. Also bump `ios.buildNumber` and `android.versionCode`.

Store screenshots from the Pixel 7 emulator are in `store/screenshots/` (1080×2400 PNG).
