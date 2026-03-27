import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBc3ryOJEFBQlJIUpy835Anej0OulZqHEQ",
  authDomain: "linksdrive-4012c.firebaseapp.com",
  projectId: "linksdrive-4012c",
  storageBucket: "linksdrive-4012c.firebasestorage.app",
  messagingSenderId: "91948654259",
  appId: "1:91948654259:web:2b596baed6d1ab78cc5ac6",
  measurementId: "G-V1EZDLJQ2K"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const linksRef = collection(db, "links");
export const notesRef = collection(db, "notes");