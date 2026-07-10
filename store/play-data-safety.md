# Play Store Data Safety Form — Answers

Google Play requires every app to fill out a Data Safety form declaring what data the app collects and how it's used. Below are the answers for Templateify Pro.

## Summary

**Does your app collect or share any of the required user data types?**
→ **No** (with one caveat: AdMob collects device identifiers for ad serving in the Free tier)

Because AdMob is in the picture, you must declare the AdMob data collection even though Templateify itself collects nothing.

---

## Step-by-step answers

### 1. Data collection

**Does your app collect or share any of the required user data types?**
→ **Yes** (because of AdMob in the Free tier)

> **Note**: If you're submitting the Pro-only build (no ads), select **No** and skip the rest. Most likely you're submitting the Free tier with ads, so select **Yes**.

### 2. Data types collected

Check ONLY these:

| Data type | Collected? | Details |
|-----------|-----------|---------|
| **Approximate location** | ✅ (AdMob) | Coarse (approximate) — collected by AdMob for ad personalization |
| **Email address** | ❌ | Not collected |
| **Personal identifiers** (user IDs, device IDs, advertising IDs) | ✅ (AdMob) | Advertising ID — collected by AdMob for ad serving |
| **App activity** (app searches, views, interactions) | ❌ | Not collected by Templateify; AdMob may collect app interactions but we don't configure it |
| **App info and performance** (crash logs, diagnostics) | ❌ | Not collected (no crash reporting SDK) |
| **Device or other IDs** | ✅ (AdMob) | Collected by AdMob |
| Photos and videos | ❌ | |
| Audio data | ❌ | |
| Files and docs | ❌ | (PDF/DOCX/etc. are imported + processed locally; never uploaded) |
| Calendar | ❌ | |
| Contacts | ❌ | |
| Health and fitness | ❌ | |
| Financial info | ❌ | (IAP is handled by Google Play Billing; we don't see payment info) |
| Messages | ❌ | |
| Location (precise) | ❌ | |
| Web browsing history | ❌ | |
| Purchase history | ❌ | (We verify the Pro unlock receipt locally; Google Play may show your purchase history) |

### 3. For each collected data type, answer:

**For "Approximate location" (AdMob):**
- **Is this data collected, shared, or both?** → Collected
- **Is this data processed ephemerally?** → No
- **Is this data required for your app, or can users choose whether it's collected?** → Users can choose (ad personalization can be disabled in Google Settings)
- **Why is this data collected?** → Advertising or marketing (check this)
- **Is this data shared with third parties?** → No (it stays with AdMob)

**For "Personal identifiers" → "Advertising ID" (AdMob):**
- **Collected/shared/both?** → Collected
- **Ephemeral?** → No
- **Required or optional?** → Optional (Pro users don't send ad requests)
- **Why?** → Advertising or marketing
- **Shared with third parties?** → No

**For "Device or other IDs" (AdMob):**
- Same answers as Advertising ID

### 4. Data security

**Is all user data encrypted in transit?**
→ **Yes** (all network requests use HTTPS; the app's own data never leaves the device except for AdMob + IAP, both of which use HTTPS)

**Do you provide a way for users to request deletion of their data?**
→ **Yes** (Settings → "Clear all data" deletes all local data; for AdMob data, users can request deletion via Google's AdMob data deletion request process — link to https://support.google.com/admob/answer/6128543)

### 5. App access

**Is your app designed for children?**
→ **No** (target audience is 13+)

**Does your app target children under 13?**
→ **No**

### 6. Government apps / Health apps / Financial apps

All → **No**

---

## Privacy Policy URL

Host the `privacy-policy.html` file (in this `/store/` directory) at a stable URL like:
```
https://templateify.com/privacy
```

You can use any static host: Netlify, Vercel, Cloudflare Pages, GitHub Pages, or even the Play Store's own hosted policy. Just put the URL in Play Console → App content → Privacy Policy.

## Notes

- **Pro-only build (no ads)**: If you ship a separate Pro build without AdMob, the form is much simpler — answer "No" to data collection, and you don't need to declare AdMob.
- **Future SaaS tier (Phase 3)**: When cloud sync launches, you'll need to update this form to declare the data types that get synced (templates, folders, fill values — all encrypted at rest). Plan to re-submit the form before the SaaS tier goes live.
