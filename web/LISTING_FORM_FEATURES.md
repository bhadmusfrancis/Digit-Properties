# New Listing Form – Features (Web & Mobile)

## Address & location (web)

- **Address autocomplete**: Start typing an address; suggestions come from OpenStreetMap (Nominatim). Selecting one fills address, city, state, and suburb.
- **GPS**: Use the "GPS" button to use the device’s current location. The app reverse‑geocodes it and fills the address fields. You can still edit them.
- **Map picker**: Use the "Map" button to show a map. Click a point to set the property location; the address fields are filled from that point. City, state, and suburb remain editable.
- **Suburb**: Optional “Suburb / Area” field (e.g. “Lekki Phase 1”). Filled by autocomplete/GPS/map but always editable.

## Title (SEO)

- **Generate title**: The **Title** field is in the **Title & contact** section. **Click (focus) the title field** to **“Generate title”** to build a title from:
  - Listing type (sale/rent)
  - Property type
  - State, city, suburb
  - Bedrooms, bathrooms, toilets, area
  - Amenities and words from the description (e.g. luxury, modern, spacious)
- You can edit the generated title before publishing or saving as draft.

## Amenities

- **15 popular amenities** are shown as toggles: Parking, Security, 24hr Power, Generator, Pool, Gym, Fitted Kitchen, BQ, Garden, Water Supply, Elevator, AC, WiFi, CCTV, Serviced.
- You can also type custom amenities (comma‑separated) in the field below.

## Images & video (web)

- **Reorder**: Use the arrows under each image to move it left/right. The first image is used in search/social previews (SEO).
- **Camera**: “Use camera” uses the device camera (or file picker as fallback) to add a photo.
- **SEO**: Recommended image specs are shown (e.g. 1200×630 or 1920×1080, JPEG/PNG/WebP, max 10MB).
- **Video**: The upload API accepts video (MP4/WebM, max 50MB). The listing model supports a `videos` array; you can extend the form to allow video uploads in the UI.

## Mobile (cross‑platform)

- **Create listing**: On the Expo app, “Create Listing” and “+ Create Listing (web)” open the **web** new‑listing page in the browser.
- In the mobile browser, address autocomplete, GPS, map picker, camera, and title generator all work (browser geolocation and file input).
- Listings on mobile show **suburb** in the location line when present (suburb, city, state).

## API & model

- **Location** now supports optional `suburb` and `coordinates: { lat, lng }`.
- **Videos**: Listing model has optional `videos: { public_id, url }[]`. Upload API accepts video files; wire the form to send `videos` when you add a video upload control.
- **Geocode**: `GET /api/geocode?q=...` for address search; `GET /api/geocode?lat=...&lon=...` for reverse geocoding. Used by the web form only; no API key required (Nominatim).

## Dependencies (web)

- **Leaflet** (leaflet, react-leaflet, @types/leaflet) for the map picker. CSS is imported in `MapPicker.tsx`.
