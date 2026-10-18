import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, getDoc, deleteDoc,
  query, orderBy, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = firebaseConfig.apiKey !== "PASTE_FIREBASE_API_KEY" &&
                   firebaseConfig.projectId !== "PASTE_PROJECT_ID" &&
                   firebaseConfig.appId !== "PASTE_FIREBASE_APP_ID";

let app, auth, db;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const $ = (id) => document.getElementById(id);
const audio = $("audio");
let songs = [];
let visibleSongs = [];
let currentIndex = -1;
let currentUser = null;
let isAdmin = false;
let authMode = "login";
let activeView = "home";
let activeLanguage = "";
let favorites = new Set();
let noticeTimer;

$("year").textContent = new Date().getFullYear();

function notify(message) {
  const el = $("notice");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
function safeText(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function validHttpUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function friendlyError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "ഈ ഇമെയിൽ ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്.",
    "auth/invalid-email": "ശരിയായ ഇമെയിൽ വിലാസം നൽകുക.",
    "auth/weak-password": "കുറഞ്ഞത് 6 അക്ഷരങ്ങളുള്ള പാസ്‌വേഡ് നൽകുക.",
    "auth/invalid-credential": "ഇമെയിൽ അല്ലെങ്കിൽ പാസ്‌വേഡ് ശരിയല്ല.",
    "auth/user-not-found": "ഈ ഇമെയിലിൽ അക്കൗണ്ട് കണ്ടെത്തിയില്ല.",
    "permission-denied": "അനുമതി ലഭിച്ചില്ല. Firestore Rules പരിശോധിക്കുക.",
    "unavailable": "സേവനം താൽക്കാലികമായി ലഭ്യമല്ല. വീണ്ടും ശ്രമിക്കുക."
  };
  return map[code] || error?.message || "ഒരു പിശക് സംഭവിച്ചു.";
}
function showAuth(mode) {
  authMode = mode;
  $("authHeading").textContent = mode === "register" ? "Create your account" : "Welcome back";
  $("authSubheading").textContent = mode === "register" ? "Save your favourites and build your music collection." : "Sign in to save your favourite music.";
  $("nameField").hidden = mode !== "register";
  $("displayName").required = mode === "register";
  $("authSubmit").textContent = mode === "register" ? "Create account" : "Login";
  $("authSwitch").innerHTML = mode === "register"
    ? 'Already have an account? <button id="switchAuth" type="button">Login</button>'
    : 'New here? <button id="switchAuth" type="button">Create an account</button>';
  $("authMessage").textContent = "";
  $("authDialog").showModal();
  $("switchAuth").addEventListener("click", () => showAuth(authMode === "register" ? "login" : "register"));
}
function requireFirebase() {
  if (!configured) {
    notify("ആദ്യം firebase-config.js-ൽ Firebase config ചേർക്കുക. README.md കാണുക.");
    return false;
  }
  return true;
}
async function checkAdmin(user) {
  if (!user || !db) return false;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists() && snap.data().active === true;
  } catch (error) {
    console.error("Admin role check failed", error);
    return false;
  }
}
function getCoverMarkup(song) {
  if (song.coverUrl && validHttpUrl(song.coverUrl)) {
    return `<img loading="lazy" src="${safeText(song.coverUrl)}" alt="" onerror="this.remove()">`;
  }
  return `<div class="cover-placeholder" aria-hidden="true">♫</div>`;
}
function renderSongs() {
  const search = $("searchInput").value.trim().toLowerCase();
  visibleSongs = songs.filter(song => {
    const languageOK = !activeLanguage || song.language === activeLanguage;
    const favoriteOK = activeView !== "favorites" || favorites.has(song.id);
    const haystack = `${song.title} ${song.artist} ${song.album || ""} ${song.language}`.toLowerCase();
    return languageOK && favoriteOK && haystack.includes(search);
  });
  if (activeView === "favorites") $("sectionTitle").textContent = "My favourites";
  else if (activeLanguage) $("sectionTitle").textContent = `${activeLanguage} music`;
  else $("sectionTitle").textContent = "Featured music";
  $("songCount").textContent = `${visibleSongs.length} ${visibleSongs.length === 1 ? "track" : "tracks"}`;
  const grid = $("songGrid");
  if (!visibleSongs.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">♫</div><h3>${activeView === "favorites" ? "No favourites yet" : "No tracks found"}</h3><p>${activeView === "favorites" ? "Tap the heart on a song to save it here." : "Try another search or add permitted tracks from the admin panel."}</p></div>`;
    return;
  }
  grid.innerHTML = visibleSongs.map(song => `
    <article class="song-card">
      <div class="cover-wrap">${getCoverMarkup(song)}
        <button class="cover-play" data-play="${safeText(song.id)}" aria-label="Play ${safeText(song.title)}">▶</button>
      </div>
      <div class="song-info">
        <div class="song-title" title="${safeText(song.title)}">${safeText(song.title)}</div>
        <div class="song-artist">${safeText(song.artist)}${song.album ? " · " + safeText(song.album) : ""}</div>
        <div class="song-meta"><span class="language-pill">${safeText(song.language)}</span>
          <div class="card-actions">
            <button class="small-icon ${favorites.has(song.id) ? "favorited" : ""}" data-fav="${safeText(song.id)}" aria-label="Toggle favourite">${favorites.has(song.id) ? "♥" : "♡"}</button>
            ${song.downloadAllowed ? `<a class="small-icon" href="${safeText(song.audioUrl)}" download target="_blank" rel="noopener" title="Download" aria-label="Download ${safeText(song.title)}">↓</a>` : ""}
          </div>
        </div>
      </div>
    </article>`).join("");
  grid.querySelectorAll("[data-play]").forEach(button => button.addEventListener("click", () => playSong(button.dataset.play)));
  grid.querySelectorAll("[data-fav]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.fav)));
}
function updatePlayer(song) {
  $("playerTitle").textContent = song.title;
  $("playerArtist").textContent = `${song.artist} · ${song.language}`;
  $("playerCover").innerHTML = song.coverUrl && validHttpUrl(song.coverUrl) ? `<img src="${safeText(song.coverUrl)}" alt="">` : "♫";
  $("playerFav").textContent = favorites.has(song.id) ? "♥" : "♡";
  $("playerFav").style.color = favorites.has(song.id) ? "#e65e88" : "";
  const download = $("downloadBtn");
  if (song.downloadAllowed) {
    download.href = song.audioUrl;
    download.classList.remove("disabled");
    download.setAttribute("download", "");
    download.target = "_blank";
    download.rel = "noopener";
  } else {
    download.href = "#";
    download.classList.add("disabled");
    download.removeAttribute("download");
    download.removeAttribute("target");
  }
}
async function playSong(id) {
  const index = songs.findIndex(song => song.id === id);
  if (index < 0) return;
  const song = songs[index];
  if (!validHttpUrl(song.audioUrl)) return notify("ഈ പാട്ടിന്റെ audio URL ശരിയല്ല.");
  currentIndex = index;
  audio.src = song.audioUrl;
  audio.load();
  updatePlayer(song);
  try {
    await audio.play();
    $("playBtn").textContent = "Ⅱ";
  } catch (error) {
    $("playBtn").textContent = "▶";
    console.error("Audio playback failed:", error);
    if (audio.error) {
      const messages = {
        1: "ഓഡിയോ പ്ലേ ചെയ്യുന്നത് നിർത്തി.",
        2: "നെറ്റ്‌വർക്ക് പ്രശ്നം. വീണ്ടും ശ്രമിക്കുക.",
        3: "ഓഡിയോ ഫയൽ decode ചെയ്യാൻ കഴിഞ്ഞില്ല.",
        4: "ഈ ഓഡിയോ ഫയൽ ബ്രൗസറിന് പ്ലേ ചെയ്യാൻ കഴിയുന്നില്ല."
      };
      notify(messages[audio.error.code] || "ഓഡിയോ പ്ലേ ചെയ്യാനായില്ല. Audio URL പരിശോധിക്കുക.");
    } else {
      notify("പ്ലേ ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും Play അമർത്തി ശ്രമിക്കുക.");
    }
  }
  renderSongs();
}
async function toggleFavorite(id) {
  if (!currentUser) {
    notify("Favourites ഉപയോഗിക്കാൻ ആദ്യം Login ചെയ്യുക.");
    showAuth("login");
    return;
  }
  if (!db) return;
  const wasFavorite = favorites.has(id);
  try {
    const ref = doc(db, "users", currentUser.uid, "favorites", id);
    if (wasFavorite) {
      await deleteDoc(ref);
      favorites.delete(id);
    } else {
      await setDoc(ref, { songId: id, createdAt: serverTimestamp() });
      favorites.add(id);
    }
    renderSongs();
    if (currentIndex >= 0) updatePlayer(songs[currentIndex]);
  } catch (error) { notify(friendlyError(error)); }
}
async function loadFavorites() {
  favorites = new Set();
  if (!currentUser || !db) return;
  try {
    const snap = await getDocs(collection(db, "users", currentUser.uid, "favorites"));
    snap.forEach(d => favorites.add(d.id));
  } catch (error) { console.warn("Could not load favourites", error); }
}
async function loadSongs() {
  if (!db) { renderSongs(); return; }
  try {
    const snap = await getDocs(query(collection(db, "songs"), orderBy("createdAt", "desc")));
    songs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.active === false) return;
      if (!data.title || !data.artist || !["Malayalam", "Tamil"].includes(data.language) || !validHttpUrl(data.audioUrl || "")) return;
      songs.push({ id: d.id, title: data.title, artist: data.artist, album: data.album || "", language: data.language, coverUrl: data.coverUrl || "", audioUrl: data.audioUrl, downloadAllowed: data.downloadAllowed === true });
    });
    renderSongs();
    if (isAdmin) renderAdminList();
  } catch (error) {
    console.error(error);
    notify("പാട്ടുകളുടെ പട്ടിക ലോഡ് ചെയ്യാനായില്ല. Firestore Rules പരിശോധിക്കുക.");
  }
}
async function loadProfile() {
  if (!currentUser) {
    $("profileContent").innerHTML = "<p>Login ചെയ്താൽ നിങ്ങളുടെ profile കാണാം.</p>";
    return;
  }
  $("profileContent").innerHTML = `<strong>${safeText(currentUser.displayName || "Music listener")}</strong>${safeText(currentUser.email)}<br>Saved favourites: ${favorites.size}<br>Account UID: <code>${safeText(currentUser.uid)}</code>`;
}
async function renderAdminList() {
  const el = $("adminSongList");
  if (!isAdmin) { el.textContent = "Admin access required."; return; }
  if (!songs.length) { el.textContent = "No tracks yet."; return; }
  el.innerHTML = songs.map(song => `<div class="admin-track"><div><strong>${safeText(song.title)}</strong><span>${safeText(song.artist)} · ${safeText(song.language)}</span></div><button class="delete-song" data-delete="${safeText(song.id)}">Delete</button></div>`).join("");
  el.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => {
    if (!confirm("ഈ പാട്ടിന്റെ metadata നീക്കണോ? R2-യിലെ audio file ഇത് നീക്കില്ല.")) return;
    try {
      await deleteDoc(doc(db, "songs", button.dataset.delete));
      notify("പാട്ടിന്റെ entry നീക്കി.");
      await loadSongs();
    } catch (error) { $("adminMessage").textContent = friendlyError(error); }
  }));
}
async function addSong(event) {
  event.preventDefault();
  $("adminMessage").textContent = "";
  if (!isAdmin) { $("adminMessage").textContent = "Admin permission ഇല്ല."; return; }
  const title = $("songTitle").value.trim();
  const artist = $("songArtist").value.trim();
  const language = $("songLanguage").value;
  const album = $("songAlbum").value.trim();
  const coverUrl = $("songCover").value.trim();
  const audioUrl = $("songAudio").value.trim();
  const downloadAllowed = $("songDownload").value === "true";
  if (!title || !artist || !["Malayalam", "Tamil"].includes(language) || !validHttpUrl(audioUrl) || (coverUrl && !validHttpUrl(coverUrl))) {
    $("adminMessage").textContent = "എല്ലാ വിവരങ്ങളും ശരിയായ URL-ഉം നൽകുക.";
    return;
  }
  try {
    await addDoc(collection(db, "songs"), {
      title, artist, language, album, coverUrl, audioUrl, downloadAllowed,
      active: true, createdAt: serverTimestamp(), createdBy: currentUser.uid
    });
    $("songForm").reset();
    $("adminMessage").textContent = "പാട്ട് ചേർത്തു.";
    notify("പാട്ട് വിജയകരമായി ചേർത്തു.");
    await loadSongs();
  } catch (error) { $("adminMessage").textContent = friendlyError(error); }
}
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireFirebase()) return;
  $("authMessage").textContent = "";
  const email = $("email").value.trim();
  const password = $("password").value;
  try {
    if (authMode === "register") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const name = $("displayName").value.trim();
      if (name) await updateProfile(credential.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    $("authDialog").close();
    notify(authMode === "register" ? "അക്കൗണ്ട് സൃഷ്ടിച്ചു." : "Login വിജയിച്ചു.");
  } catch (error) { $("authMessage").textContent = friendlyError(error); }
});
$("songForm").addEventListener("submit", addSong);
$("loginBtn").addEventListener("click", () => showAuth("login"));
$("registerBtn").addEventListener("click", () => showAuth("register"));
$("profileBtn").addEventListener("click", async () => { await loadProfile(); $("profileDialog").showModal(); });
$("adminBtn").addEventListener("click", async () => { if (!isAdmin) return notify("Admin permission ഇല്ല."); await renderAdminList(); $("adminDialog").showModal(); });
$("logoutBtn").addEventListener("click", async () => {
  if (!auth) return;
  await signOut(auth);
  $("profileDialog").close();
  notify("Logout ചെയ്തു.");
});
$("searchInput").addEventListener("input", renderSongs);
document.querySelectorAll("[data-language]").forEach(button => button.addEventListener("click", () => {
  activeLanguage = button.dataset.language;
  activeView = "home";
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el === button));
  document.querySelectorAll(".filter-chip").forEach(el => el.classList.toggle("selected", el === button));
  renderSongs();
}));
document.querySelectorAll('[data-view="home"]').forEach(button => button.addEventListener("click", () => {
  activeView = "home"; activeLanguage = "";
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el === button));
  document.querySelectorAll(".filter-chip").forEach(el => el.classList.toggle("selected", el === button));
  renderSongs();
}));
document.querySelectorAll('[data-view="favorites"]').forEach(button => button.addEventListener("click", () => {
  activeView = "favorites"; activeLanguage = "";
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el === button));
  renderSongs();
}));
document.querySelectorAll('[data-sort="newest"]').forEach(button => button.addEventListener("click", () => {
  songs.sort((a,b) => 0); renderSongs();
}));
$("exploreBtn").addEventListener("click", () => $("songGrid").scrollIntoView({ behavior: "smooth", block: "start" }));
$("playBtn").addEventListener("click", async () => {
  if (currentIndex < 0) {
    if (visibleSongs.length) return playSong(visibleSongs[0].id);
    return notify("ആദ്യം ഒരു പാട്ട് ചേർക്കുക.");
  }
  if (audio.paused) {
    try { await audio.play(); $("playBtn").textContent = "Ⅱ"; }
    catch { notify("പാട്ട് പ്ലേ ചെയ്യാനായില്ല. Audio URL പരിശോധിക്കുക."); }
  } else { audio.pause(); $("playBtn").textContent = "▶"; }
});
$("prevBtn").addEventListener("click", () => {
  if (!songs.length) return;
  const next = (currentIndex <= 0 ? songs.length - 1 : currentIndex - 1);
  playSong(songs[next].id);
});
$("nextBtn").addEventListener("click", () => {
  if (!songs.length) return;
  playSong(songs[(currentIndex + 1) % songs.length].id);
});
$("playerFav").addEventListener("click", () => { if (currentIndex >= 0) toggleFavorite(songs[currentIndex].id); });
$("volumeBar").addEventListener("input", () => { audio.volume = Number($("volumeBar").value); });
audio.volume = 0.8;
audio.addEventListener("timeupdate", () => {
  $("currentTime").textContent = formatTime(audio.currentTime);
  $("duration").textContent = formatTime(audio.duration);
  if (Number.isFinite(audio.duration) && audio.duration > 0) $("seekBar").value = String(audio.currentTime / audio.duration * 100);
});
$("seekBar").addEventListener("input", () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number($("seekBar").value) / 100 * audio.duration;
});
audio.addEventListener("ended", () => { if (songs.length) playSong(songs[(currentIndex + 1) % songs.length].id); });
audio.addEventListener("error", () => {
  if (audio.src) {
    $("playBtn").textContent = "▶";
    console.error("Audio element error:", audio.error);
  }
});

if (configured) {
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    isAdmin = await checkAdmin(user);
    $("loginBtn").hidden = !!user;
    $("registerBtn").hidden = !!user;
    $("profileBtn").hidden = false;
    $("adminBtn").hidden = !isAdmin;
    await loadFavorites();
    await loadSongs();
  });
} else {
  $("loginBtn").addEventListener("click", () => notify("Firebase config ചെയ്യാൻ README.md പിന്തുടരുക."));
  $("registerBtn").addEventListener("click", () => notify("Firebase config ചെയ്യാൻ README.md പിന്തുടരുക."));
  songs = [];
  renderSongs();
  console.info("Raaga demo mode: configure firebase-config.js to connect Firebase.");
}
