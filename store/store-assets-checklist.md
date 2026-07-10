# Store Assets Checklist — Templateify Pro

Everything you need to prepare before submitting to Google Play and the Apple App Store.

## Icons

| Asset | Size | Purpose | Status |
|-------|------|---------|--------|
| `icon-16x16.png` | 16×16 | Favicon | ☐ Create |
| `icon-32x32.png` | 32×32 | Favicon (high-res) | ☐ Create |
| `icon-180x180.png` | 180×180 | Apple touch icon | ☐ Create |
| `icon-192x192.png` | 192×192 | PWA + Android | ☐ Create |
| `icon-512x512.png` | 512×512 | PWA + Play Store | ☐ Create |
| `icon-512x512-maskable.png` | 512×512 | Android adaptive icon (logo centered in inner 80% safe zone) | ☐ Create |
| **`icon-1024x1024.png`** | 1024×1024 | **App Store** (NO alpha channel — Apple rejects alpha) | ☐ Create |
| **`feature-graphic.png`** | 1024×500 | **Play Store** feature graphic (top of listing) | ☐ Create |

**Design notes**:
- All icons should use the indigo brand color (`#4f46e5`) as the background.
- The logo: a stylized document icon with a fill-in field (matches the in-app header logo).
- Maskable icon: keep the logo within the inner 80% safe zone so Android adaptive icon cropping doesn't cut it off.
- App Store 1024×1024: must be flat (no alpha). Use a solid indigo background.
- Feature graphic: show the app in action — a phone with Fill Mode open, plus the tagline "Fill-in templates. Copy. Done."

## Screenshots

### Android (Play Store)

| Asset | Size | Quantity | Status |
|-------|------|----------|--------|
| Phone screenshots | 320–3840px (longest side), 16:9 or 9:16 | 2–8 required | ☐ Create 5 |
| 7" tablet screenshots | 320–3840px | Optional | ☐ Skip (universal layout) |
| 10" tablet screenshots | 320–3840px | Optional | ☐ Skip |

**Recommended 5 phone screenshots**:
1. Fill Mode open on a sample template (email reply) — caption: "Fill in the blanks, then copy."
2. Edit Mode with token-creation toolbar visible — caption: "Turn any text into a blank, option, or private field."
3. Library view with nested folders — caption: "Organize with folders and subfolders."
4. Settings modal showing theme toggle + Pro upgrade card — caption: "Dark mode. Offline-first. No account needed."
5. Export menu with all formats — caption: "Export to TXT, MD, HTML, PDF, Python, Jupyter, JSON."

### iOS (App Store)

| Asset | Size | Quantity | Status |
|-------|------|----------|--------|
| iPhone 6.7" screenshots | 1290×2796 | Required | ☐ Create 5 |
| iPhone 6.5" screenshots | 1242×2688 | Required (or 5.5") | ☐ Create 5 (can reuse 6.7" resized) |
| iPad 12.9" screenshots | 2048×2732 | Required if iPad-supported | ☐ Create 5 |

**Use the same 5 captions as Android.**

### App Preview video (iOS, optional but recommended)

- 15–30 seconds, shows Fill Mode flow (open template → fill blank → tap Copy → paste in email)
- Vertical (portrait), 1080×1920 or 1290×2796
- Format: H.264 MP4, MOV, or M4V

## App config

| Setting | Value |
|---------|-------|
| Application ID (Android) | `com.templateify.pro` |
| Bundle ID (iOS) | `com.templateify.pro` |
| Version name | `7.0.0` |
| Version code (Android, int) | `1` (increment every upload) |
| Build number (iOS) | `1` (increment every TestFlight) |
| Min Android SDK | 23 (Android 6.0, ~99% coverage) |
| Target Android SDK | 34 (Android 14, required for new submissions) |
| Min iOS version | 14.0 (Capacitor 6 requirement) |
| Device families (iOS) | iPhone + iPad (universal) |
| Orientation | Portrait + Landscape (app is responsive) |

## Store listing URLs

| Page | URL | Status |
|------|-----|--------|
| Privacy Policy | `https://templateify.com/privacy` | ☐ Host `store/privacy-policy.html` here |
| Terms of Service | `https://templateify.com/terms` | ☐ Host `store/terms-of-service.html` here |
| Support URL | `https://templateify.com/support` | ☐ Create (can be a simple contact form or mailto:) |
| Support email | `support@templateify.com` | ☐ Create inbox |
| Marketing website | `https://templateify.com` | ☐ Create (can be a single landing page) |

## IAP product

| Store | Product ID | Type | Price | Status |
|-------|-----------|------|-------|--------|
| Google Play | `pro_unlock` | Non-consumable | $4.99 USD (₱249 PH) | ☐ Create in Play Console |
| App Store | `pro_unlock` | Non-consumable | $4.99 USD (₱249 PH) | ☐ Create in App Store Connect |

## AdMob

| Asset | Status |
|-------|--------|
| AdMob account | ☐ Create at https://admob.google.com/ |
| Android app registered in AdMob | ☐ Add |
| iOS app registered in AdMob | ☐ Add |
| Android banner ad unit ID | ☐ Create |
| iOS banner ad unit ID | ☐ Create |
| Real ad unit IDs replace test placeholders in `index.html` + `capacitor.config.json` | ☐ Replace before release build |

## Pre-submission checklist

- [ ] All 6 icon PNGs + 1024×1024 + feature graphic created
- [ ] 5 phone screenshots (Android + iOS 6.7" + iOS 6.5" + iPad 12.9")
- [ ] Privacy Policy hosted at `https://templateify.com/privacy`
- [ ] Terms of Service hosted at `https://templateify.com/terms`
- [ ] Support email + support URL live
- [ ] IAP product `pro_unlock` created + activated in both stores
- [ ] AdMob real ad unit IDs replace test placeholders
- [ ] Play Data Safety form filled (see `play-data-safety.md`)
- [ ] App signed with release keystore (Android) / distribution cert (iOS)
- [ ] Tested on at least 2 real Android devices + 2 real iOS devices
- [ ] Tested IAP purchase with License Tester (Android) + Sandbox Tester (iOS)
- [ ] Tested AdMob banner shows real ads (not test ads) on release build
- [ ] Tested Pro unlock hides ads + unlocks all features
- [ ] Tested offline mode (airplane mode) — app should work fully
- [ ] Tested file:// protocol (open `index.html` directly) — for users who download the web version

## Post-launch checklist

- [ ] Monitor Play Console crashes + ANRs for first 48 hours
- [ ] Monitor App Store Connect crash logs
- [ ] Respond to all user reviews within 24 hours
- [ ] Track AdMob revenue + fill rate
- [ ] Track IAP conversion rate (Free → Pro)
- [ ] Plan first update (v7.0.1) for any critical bugs within 2 weeks
