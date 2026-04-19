# 🚀 BIT TeamHub — Setup Guide

A full-featured team dashboard for BIT Sathy with Google Auth, real-time chat, leaderboard, queries system, and admin panel.

---

## 📁 Files
```
index.html          ← Login page
dashboard.html      ← Main dashboard
members.html        ← Member directory + point management
chat.html           ← Real-time group chat
queries.html        ← Query submission & replies
leaderboard.html    ← Activity & reward leaderboard
profile.html        ← User profile editor
admin.html          ← Admin panel (admin-only)
style.css           ← Shared styles
firebase-config.js  ← Firebase setup (EDIT THIS)
shell.js            ← Shared sidebar/layout
README.md           ← This file
```

---

## ⚙️ Step 1 — Create a Firebase Project

1. Go to **https://console.firebase.google.com/**
2. Click **Add Project** → name it `bit-teamhub` → Continue
3. Disable Google Analytics (optional) → **Create Project**

---

## ⚙️ Step 2 — Enable Google Auth

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Google** → set your project email → Save
3. Under **Authorized domains**, add your hosting domain (or `localhost` for testing)

---

## ⚙️ Step 3 — Create Firestore Database

1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **Production mode** → select region → Done
3. Go to **Rules** tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — read by all members, write only to own doc or admin
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.token.email.matches('.*@bitsathy\\.ac\\.in');
      allow write: if request.auth != null && (request.auth.uid == uid || 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Chat — any authenticated bitsathy member
    match /chat_messages/{id} {
      allow read, write: if request.auth != null && request.auth.token.email.matches('.*@bitsathy\\.ac\\.in');
    }

    // Queries — member reads own, admin reads all
    match /queries/{id} {
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth != null && request.auth.token.email.matches('.*@bitsathy\\.ac\\.in');
      allow update: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }

    // Activity log — any member can read, admin can write
    match /activity_log/{id} {
      allow read: if request.auth != null && request.auth.token.email.matches('.*@bitsathy\\.ac\\.in');
      allow write: if request.auth != null;
    }
  }
}
```

4. Click **Publish**

---

## ⚙️ Step 4 — Get Your Config

1. Firebase Console → **Project Settings** (gear icon) → **Your Apps**
2. Click **</>** (Web app) → register app → copy the config object
3. Open `firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:123:web:abc"
};

// Put YOUR email here — you'll auto-become the first admin
const BOOTSTRAP_ADMIN_EMAIL = "youremail@bitsathy.ac.in";
```

---

## ⚙️ Step 5 — Host It

### Option A — Firebase Hosting (recommended, free)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, public dir = . (current folder)
firebase deploy
```

### Option B — Any static host
Upload all files to **Vercel**, **Netlify**, **GitHub Pages**, or any web server.

### Option C — Local testing
```bash
# Install a simple static server
npx serve .
# Then open http://localhost:3000
```

> ⚠️ **CORS note**: Firebase Auth popup needs HTTPS or localhost. Add your domain to Firebase Auth → Authorized domains.

---

## 👑 First Admin

When you first log in with `BOOTSTRAP_ADMIN_EMAIL`, your account is automatically set to `admin` role. You can then:
- Go to **Members** page → click **Make Admin** on any user
- Or go to **Admin Panel** → Members & Points → toggle admin with the shield button

---

## ✨ Features Summary

| Feature | Members | Admins |
|---|---|---|
| Dashboard with personal stats | ✅ | ✅ |
| Group real-time chat | ✅ | ✅ |
| Submit queries to admin | ✅ | — |
| Reply to all queries | — | ✅ |
| View leaderboard | ✅ | ✅ |
| Edit own profile | ✅ | ✅ |
| Add/deduct points for anyone | — | ✅ |
| Make/remove admins | — | ✅ |
| Admin panel overview | — | ✅ |
| View all member profiles | — | ✅ |
| Bulk award points | — | ✅ |

---

## 🔐 Security Notes

- Only `@bitsathy.ac.in` Google accounts can sign in (enforced both in UI and Firestore rules)
- Firestore rules prevent cross-user data tampering
- Admin role checked server-side in Firestore rules for all sensitive operations
- Never expose your Firebase config — it's safe to include in frontend as Firestore rules enforce access control
