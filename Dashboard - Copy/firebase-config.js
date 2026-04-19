// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxZiednPiJClC_4IEy7M-RFXwskDiuQwM",
  authDomain: "dashboard-92ad8.firebaseapp.com",
  projectId: "dashboard-92ad8",
  storageBucket: "dashboard-92ad8.firebasestorage.app",
  messagingSenderId: "307542053247",
  appId: "1:307542053247:web:3071cacbb13b04f12eca4a",
  measurementId: "G-RZVJW4PQE0"
};

// Bootstrap admin configuration
const BOOTSTRAP_ADMIN_EMAIL = "jaydinakarr.ad@bitsathy.ac.in";
const OWNER_UID = "XZqBRFqYPoTetRcMOUfb2LyaoiF2";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = typeof firebase.storage === "function" ? firebase.storage() : null;
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ hd: "bitsathy.ac.in" });

let activityCleanupPromise = null;

async function getOrCreateUser(firebaseUser) {
  const ref = db.collection("users").doc(firebaseUser.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const isBootstrap =
      firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL || firebaseUser.uid === OWNER_UID;

    await ref.set({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || "",
      photoURL: firebaseUser.photoURL || "",
      role: isBootstrap ? "admin" : "member",
      accountStatus: "active",
      activityPoints: 0,
      rewardPoints: 0,
      bio: "",
      department: "",
      year: "",
      phone: "",
      github: "",
      linkedin: "",
      website: "",
      interest: "",
      goal: "",
      skills: [],
      online: false,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const data = snap.data();
    if (data.accountStatus === "blocked") {
      return data;
    }

    const update = {
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (
      (firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL || firebaseUser.uid === OWNER_UID) &&
      data.role !== "admin"
    ) {
      update.role = "admin";
    }

    await ref.update(update);
  }

  const freshSnap = await ref.get();
  return freshSnap.exists ? freshSnap.data() : null;
}

async function currentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection("users").doc(user.uid).get();
  return snap.exists ? snap.data() : null;
}

function redirectIfNotAuth(targetLogin = "index.html") {
  auth.onAuthStateChanged(user => {
    if (!user) window.location.href = targetLogin;
  });
}

function redirectIfAuth(targetDash = "dashboard.html") {
  auth.onAuthStateChanged(user => {
    if (user) window.location.href = targetDash;
  });
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(value) {
  const date = toDateValue(value);
  if (!date) return "";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(value) {
  const date = toDateValue(value);
  if (!date) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getLocalDayKey(value = new Date()) {
  const date = value instanceof Date ? value : toDateValue(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(value) {
  const date = toDateValue(value);
  if (!date) return false;
  return getLocalDayKey(date) === getLocalDayKey(new Date());
}

function sortByCreatedAtDesc(items, field = "createdAt") {
  return [...items].sort((a, b) => {
    const aTime = toDateValue(a?.[field])?.getTime() || 0;
    const bTime = toDateValue(b?.[field])?.getTime() || 0;
    return bTime - aTime;
  });
}

function sortByCreatedAtAsc(items, field = "createdAt") {
  return [...items].sort((a, b) => {
    const aTime = toDateValue(a?.[field])?.getTime() || 0;
    const bTime = toDateValue(b?.[field])?.getTime() || 0;
    return aTime - bTime;
  });
}

function getDisplayName(user) {
  return user?.displayName || user?.userName || user?.email?.split("@")[0] || "Unknown";
}

function escapeHtmlText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function activeUsersOnly(items = []) {
  return items.filter(item => (item?.accountStatus || "active") !== "blocked");
}

async function purgeOldActivityLog() {
  if (activityCleanupPromise) return activityCleanupPromise;

  activityCleanupPromise = (async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const snap = await db.collection("activity_log").get();
      const staleDocs = snap.docs.filter(doc => {
        const createdAt = toDateValue(doc.data()?.createdAt);
        return createdAt && createdAt < startOfToday;
      });

      for (let index = 0; index < staleDocs.length; index += 400) {
        const batch = db.batch();
        staleDocs.slice(index, index + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      console.warn("Daily activity cleanup skipped:", error);
    }
  })();

  return activityCleanupPromise;
}

async function logActivity({ type = "info", text, user = null, extra = {} }) {
  const actor = user || (await currentUserData());
  if (!actor || !text) return;

  try {
    await db.collection("activity_log").add({
      type,
      uid: actor.uid,
      userName: getDisplayName(actor),
      text,
      dayKey: getLocalDayKey(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra
    });
  } catch (error) {
    console.warn("Activity log write skipped:", error);
  }
}

function avatar(user, size = 36) {
  if (user?.photoURL) {
    return `<img src="${user.photoURL}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
  }

  const label = getDisplayName(user);
  const initial = label[0]?.toUpperCase() || "?";
  const colors = ["#00c853", "#448aff", "#ff9100", "#e040fb", "#ff5252", "#00bcd4"];
  const bg = colors[initial.charCodeAt(0) % colors.length];

  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;font-weight:700;font-size:${size * 0.4}px;color:#fff;flex-shrink:0;">${initial}</div>`;
}

function readableError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) {
    return "You do not have permission to do that. Please sign in with the owner/admin account.";
  }
  if (code.includes("not-found")) {
    return "The requested document was not found in Firestore.";
  }
  return error?.message || "Something went wrong. Please try again.";
}
