// ═══════════════════════════════════════════════════
//  firebase.js  —  Configurazione Firebase
//  Molinaro ESCo · Magazzino
// ═══════════════════════════════════════════════════

import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCny-fcDCu7jJSdlkv4b4vgMC_DdnVv8Yc",
  authDomain:        "magazzino-molinaro.firebaseapp.com",
  projectId:         "magazzino-molinaro",
  storageBucket:     "magazzino-molinaro.firebasestorage.app",
  messagingSenderId: "790539865839",
  appId:             "1:790539865839:web:54eedb9390949f82a9d51a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
