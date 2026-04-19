// Shared app shell
const Shell = {
  _accessWatcher: null,

  async init({ page, title, adminOnly = false }) {
    await new Promise(resolve => {
      auth.onAuthStateChanged(resolve);
    });

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      window.location.href = "index.html";
      return null;
    }

    const userData = await getOrCreateUser(firebaseUser);
    if (!userData) {
      window.location.href = "index.html";
      return null;
    }

    if (userData.accountStatus === "blocked") {
      alert("Your access has been removed by an admin. Please contact the team captain.");
      await auth.signOut();
      window.location.href = "index.html";
      return null;
    }

    if (adminOnly && userData.role !== "admin") {
      window.location.href = "dashboard.html";
      return null;
    }

    Shell._user = userData;
    Shell._isAdmin = userData.role === "admin";

    await purgeOldActivityLog();
    Shell._render(page, title, userData);
    Shell._bindLogout();
    Shell._watchAccess(userData.uid);
    Shell._liveBadge();
    return userData;
  },

  _render(page, title, userData) {
    const adminLinks = Shell._isAdmin
      ? `
        <div class="sidebar-section-label">Admin</div>
        <a href="admin.html" class="nav-item ${page === "admin" ? "active" : ""}">
          <i class="fas fa-shield-halved"></i> Admin Panel
        </a>
      `
      : "";

    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <div id="loading-screen" class="loading-screen">
        <div class="loader"></div>
      </div>

      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo">
            <div class="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#0b0e15" stroke="#0b0e15" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="logo-text">BIT <span>TeamHub</span></div>
          </div>

          <nav class="sidebar-nav">
            <div class="sidebar-section-label">Menu</div>
            <a href="dashboard.html" class="nav-item ${page === "dashboard" ? "active" : ""}">
              <i class="fas fa-grid-2"></i> Dashboard
            </a>
            <a href="members.html" class="nav-item ${page === "members" ? "active" : ""}">
              <i class="fas fa-users"></i> Members
            </a>
            <a href="chat.html" class="nav-item ${page === "chat" ? "active" : ""}">
              <i class="fas fa-comments"></i> Group Chat
              <span class="nav-badge hidden" id="chatBadge">0</span>
            </a>
            <a href="queries.html" class="nav-item ${page === "queries" ? "active" : ""}">
              <i class="fas fa-circle-question"></i> Queries
              <span class="nav-badge hidden" id="queryBadge">0</span>
            </a>
            <a href="leaderboard.html" class="nav-item ${page === "leaderboard" ? "active" : ""}">
              <i class="fas fa-trophy"></i> Leaderboard
            </a>
            <a href="lc.html" class="nav-item ${page === "lc" ? "active" : ""}">
              <i class="fas fa-book-open"></i> Learning Center
            </a>
            <a href="tasks.html" class="nav-item ${page === "tasks" ? "active" : ""}">
              <i class="fas fa-list-check"></i> Tasks
            </a>
            ${adminLinks}
            <div class="sidebar-section-label">Account</div>
            <a href="profile.html" class="nav-item ${page === "profile" ? "active" : ""}">
              <i class="fas fa-user-circle"></i> My Profile
            </a>
          </nav>

          <div class="sidebar-user">
            ${avatar(userData, 34)}
            <div class="user-info">
              <div class="user-name">${getDisplayName(userData)}</div>
              <div class="user-role">${userData.role === "admin" ? "Admin" : "Member"}</div>
            </div>
            <button class="logout-btn" id="logoutBtn" title="Sign out">
              <i class="fas fa-right-from-bracket"></i>
            </button>
          </div>
        </aside>

        <div class="main-content">
          <header class="topbar">
            <button class="topbar-icon-btn" id="menuToggle" style="display:none">
              <i class="fas fa-bars"></i>
            </button>
            <span class="topbar-title">${title}</span>
            <div class="topbar-actions">
              <a href="tasks.html" class="topbar-icon-btn" title="Tasks">
                <i class="fas fa-list-check"></i>
              </a>
              <a href="queries.html" class="topbar-icon-btn" title="Queries">
                <i class="fas fa-circle-question"></i>
              </a>
              <a href="chat.html" class="topbar-icon-btn" title="Chat">
                <i class="fas fa-comments"></i>
              </a>
              <a href="profile.html" class="topbar-icon-btn" title="Profile" style="overflow:hidden;padding:0;">
                ${
                  userData.photoURL
                    ? `<img src="${userData.photoURL}" style="width:100%;height:100%;object-fit:cover;">`
                    : `<i class="fas fa-user"></i>`
                }
              </a>
            </div>
          </header>
          <div class="page-body" id="pageBody">
      `
    );

    document.body.insertAdjacentHTML(
      "beforeend",
      `
          </div>
        </div>
      </div>
      <div id="toast-container"></div>
    `
    );

    setTimeout(() => {
      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) loadingScreen.style.display = "none";
    }, 300);

    const toggle = document.getElementById("menuToggle");
    if (window.innerWidth <= 900 && toggle) {
      toggle.style.display = "flex";
      toggle.addEventListener("click", () => {
        document.getElementById("sidebar")?.classList.toggle("open");
      });
    }
  },

  _bindLogout() {
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await db.collection("users").doc(auth.currentUser.uid).update({
        online: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
      await auth.signOut();
      window.location.href = "index.html";
    });
  },

  _watchAccess(uid) {
    if (Shell._accessWatcher) Shell._accessWatcher();
    Shell._accessWatcher = db.collection("users").doc(uid).onSnapshot(async snap => {
      const data = snap.data();
      if (data?.accountStatus === "blocked") {
        alert("Your access has been removed by an admin. You will be signed out now.");
        await auth.signOut();
        window.location.href = "index.html";
      }
    });
  },

  _liveBadge() {
    const queryBadge = document.getElementById("queryBadge");
    if (!queryBadge || !auth.currentUser) return;

    db.collection("queries")
      .where("uid", "==", auth.currentUser.uid)
      .onSnapshot(snap => {
        const unreadCount = snap.docs.filter(doc => doc.data()?.hasNewReply).length;
        if (unreadCount > 0) {
          queryBadge.textContent = unreadCount;
          queryBadge.classList.remove("hidden");
        } else {
          queryBadge.classList.add("hidden");
        }
      });
  },

  async blockMember(uid, name) {
    if (!Shell._isAdmin || uid === auth.currentUser?.uid) return false;
    const label = name || "this member";
    if (!confirm(`Remove ${label} from TeamHub and block future entry?`)) return false;

    await db.collection("users").doc(uid).update({
      accountStatus: "blocked",
      online: false,
      removedAt: firebase.firestore.FieldValue.serverTimestamp(),
      removedByUid: Shell._user.uid,
      removedByName: getDisplayName(Shell._user),
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity({
      type: "member",
      text: `removed ${label} from TeamHub access`,
      user: Shell._user,
      extra: { targetUid: uid, targetName: label }
    });

    toast(`${label} has been removed from TeamHub.`, "info");
    return true;
  }
};

function toast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = {
    success: "check-circle",
    error: "triangle-exclamation",
    info: "circle-info"
  };

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas fa-${icons[type] || icons.info}" style="color:var(--${type === "success" ? "green" : type === "error" ? "red" : "blue"})"></i>${message}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
