# Raaga — Malayalam & Tamil Music Website

A responsive light-theme music website starter built with HTML, CSS, JavaScript modules, Firebase Authentication/Firestore, and public Cloudflare R2 audio URLs.

## What is included

- Malayalam and Tamil song catalogue
- Search and language filters
- Audio player with play/pause, next/previous, seek, volume
- Optional downloads per track
- Firebase email/password registration and login
- User favourites
- Admin-only song metadata management
- Firestore security rules that prevent public users from granting themselves admin access
- Responsive layout for mobile and desktop

## Before publishing

This project is a starter that needs your Firebase project configuration and your own Cloudflare R2 public URLs. It does not ship with copyrighted songs or a preconfigured Firebase project.

## 1. Create a Firebase project

1. Open https://console.firebase.google.com/
2. Create a project.
3. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
4. In **Build → Firestore Database**, create a database.
5. In **Project settings → General → Your apps**, register a Web app.
6. Copy the Firebase web config values into `firebase-config.js`.
7. Firebase web API keys are intended to be present in client apps; security must come from Authentication and Firestore Rules, not hiding this config.

## 2. Publish the Firestore rules

1. Open **Firestore Database → Rules**.
2. Replace the rules with the contents of `firestore.rules`.
3. Click **Publish**.

## 3. Create your first admin safely

1. Register your own account through the website after Firebase config is set.
2. Open Firebase Console → Authentication → Users.
3. Copy your user UID.
4. Open Firestore Database → Data → Start collection (if needed).
5. Create collection `admins`.
6. Set document ID to the exact UID copied from Authentication.
7. Add field `active`, type **boolean**, value `true`.
8. Do not let the public website create or edit this document. The rules intentionally deny all client writes to `admins`.

The website displays Admin panel only if this document exists and `active` is `true`. The Firestore rules independently enforce the same admin check.

## 4. Set up Cloudflare R2 audio storage

1. Open Cloudflare Dashboard → R2 Object Storage.
2. Create a bucket, for example `raaga-audio`.
3. Upload only audio files that you own or have permission to distribute.
4. If using a public development URL, enable the bucket's public development URL (`r2.dev`) from the bucket settings. For production, prefer a custom domain.
5. Copy the exact public URL for each audio file.
6. Set CORS on the bucket if the browser player needs cross-origin access. Example policy (replace the origin with your GitHub Pages origin):
   ```json
   [
     {
       "AllowedOrigins": ["https://YOUR-GITHUB-USERNAME.github.io"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   If you use a custom website domain, add that exact origin too. Avoid wildcard origins for a production setup when a specific origin is known.
7. Test each public audio URL in a private browser window. It should return the audio file, not an HTML error page.

**Important:** A public R2 URL is not secret. Anyone who gets it may access the file. A frontend-only website cannot make public audio truly private. For protected downloads, use a server-side endpoint that issues short-lived signed URLs.

## 5. Add a song from Admin panel

1. Sign in with the account whose UID is in `admins/{UID}` with `active: true`.
2. Open **Admin panel** in the left sidebar.
3. Fill in song title, artist, language, optional album and cover image URL, and the public R2 audio URL.
4. Select whether download is permitted.
5. Check the permission confirmation and submit.

The admin form adds metadata to Firestore. It does not upload audio files to R2; upload those in Cloudflare Dashboard first.

## 6. Run locally

Because the app uses JavaScript modules, do not open `index.html` directly as a `file://` URL. Run a local static server, such as VS Code Live Server, or deploy to GitHub Pages.

## 7. Publish using GitHub Pages

1. Create a new GitHub repository, e.g. `malayalam-tamil-music`.
2. Upload `index.html`, `style.css`, `app.js`, `firebase-config.js`, and `firestore.rules` (README is optional).
3. Open repository **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish and open the shown URL.
7. Add the exact website origin to Cloudflare R2 CORS.
8. In Firebase Authentication settings, add your GitHub Pages host to **Authorized domains** if required by your Firebase project.

## Notes and limitations

- The project requires a Firebase config before authentication and song loading can work.
- The audio player and downloads depend on the URL being public, valid, and CORS-compatible.
- The HTML `download` attribute may be ignored by browsers for cross-origin files. If the browser opens the audio instead of downloading, configure the server/CDN to return a suitable `Content-Disposition: attachment` header or provide a same-origin download endpoint.
- This starter has no server-side upload API. Never put Cloudflare R2 access keys, Firebase service-account credentials, or other server secrets in client-side files.
- Downloading or streaming songs requires the relevant copyright/licensing permissions.
