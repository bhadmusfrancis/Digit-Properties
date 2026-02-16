# Digit Properties — Mobile App (Expo)

React Native / Expo app for Digit Properties. Connects to the web API for listings.

## Setup

1. Install dependencies: `npm install`
2. Set `EXPO_PUBLIC_API_URL` in `.env` (e.g. `https://digitproperties.com` or `http://YOUR_IP:3000` for local)
3. Run: `npx expo start`

## Structure

- `app/` — Expo Router screens
- Listings are fetched from the web API
- For full auth, listings CRUD, and payments — use the web app or extend this app with API calls
