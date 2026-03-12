import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAddMiXp7kHoDgwfJOIWNVUSU90K3bOL_U",
  authDomain: "civico-app-e4b4c.firebaseapp.com",
  projectId: "civico-app-e4b4c",
  storageBucket: "civico-app-e4b4c.firebasestorage.app",
  messagingSenderId: "61403600368",
  appId: "1:61403600368:web:fd872ce293649c4292b935"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);