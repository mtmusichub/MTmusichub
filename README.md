MT MusicHub — Song-only Home + Separate Admin

FILES:
- index.html, style.css, home.js: public home page (song list only, no sidebar)
- admin.html, admin.js: separate admin page at /admin.html
- firebase-config.js: KEEP your existing file in the GitHub repository; it is not included in this ZIP.
- FIRESTORE-ALBUMS-RULES.txt: add this match block inside your existing service cloud.firestore / match /databases/{database}/documents scope.

UPLOAD these files to the same GitHub repository root:
index.html
style.css
home.js
admin.html
admin.js

Do not delete firebase-config.js. Existing songs stay in the songs collection.
Admin login uses Firebase Authentication and checks admins/{UID} with active: true.
Admin adds albums to Firestore collection "albums", songs to "songs".
Before using Add Album, add the albums rule block from FIRESTORE-ALBUMS-RULES.txt to your existing Firestore rules, then Publish.
Open home: https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
Open admin: https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html

NOTE: Do not replace your entire Firestore rules with the snippet. Merge the albums match into the existing rules so the current songs/auth/favorites rules remain.
