# Offline Photos / 相册 (iOS-style PWA)

A fully offline-capable photo & video album web app that can be added to iPhone Home Screen via Safari.

## Features

- **Pattern Lock (九宫格手势密码)**: Set on first launch, required every time
- **Multiple Albums**: Create, browse, move media between albums
- **Import** photos & videos from device (Photos app via file picker)
- **Video thumbnails**: First frame as cover + duration badge
- **Photo viewer** with pinch-to-zoom
- **Simple photo crop**
- **Select & Delete / Move**
- **Dark / Light mode** automatic (follows system)
- **Bilingual** Chinese / English (toggle button)
- **Offline**: Service Worker + IndexedDB (media stored locally)
- **PWA**: Add to Home Screen, standalone mode, custom icons

## How to deploy on GitHub Pages

1. Create a new GitHub repository (public).
2. Upload **all files** in this folder to the root of the repository (or put them in a `/docs` folder).
3. Go to repository **Settings → Pages**.
4. Set Source to `Deploy from a branch` → Branch `main` (or `master`) → folder `/ (root)` or `/docs`.
5. Wait 1–2 minutes, then open the provided URL (e.g. `https://yourname.github.io/repo-name/`).

## Add to iPhone Home Screen

1. Open the site in **Safari** (must be Safari, not Chrome).
2. Tap the **Share** button (□↑).
3. Scroll and tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.

The app will open in full-screen standalone mode with the pattern lock.

## Usage Tips

- First open: draw a pattern (≥4 dots) twice to set the lock.
- Long-press a photo/video to enter selection mode quickly.
- Import while inside an album → media goes into that album.
- Import from Albums list → creates / uses “Recents / 最近项目”.
- Change pattern: ••• menu → Change Pattern (will reset).
- Language: top-right 中/EN button.

## Technical Notes

- Pure frontend (HTML + CSS + vanilla JS).
- Media & albums stored in **IndexedDB** (survives offline & reloads).
- Pattern stored as simple string (local only).
- No external CDN dependencies → works fully offline after first visit.
- Crop is basic (drag the crop box). Video length trim was omitted as requested (only photo crop).

## Browser Support

Best on iOS Safari / modern Chrome / Firefox / Edge.  
IndexedDB + Service Worker required.

---

Made for offline personal use. Enjoy!
