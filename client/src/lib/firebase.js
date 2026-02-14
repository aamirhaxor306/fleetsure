/**
 * Fleetsure — Firebase Client Config
 */
import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAcBzYAFafW8YPmspwM6vdWGESz9iPruDA",
  authDomain: "fleetsure-70abb.firebaseapp.com",
  projectId: "fleetsure-70abb",
  storageBucket: "fleetsure-70abb.firebasestorage.app",
  messagingSenderId: "296265813359",
  appId: "1:296265813359:web:f4d1974e2dbb04dc64ac9a",
  measurementId: "G-BVR7XDQ7ES",
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Set language to Hindi (India) for SMS
auth.languageCode = 'hi'

export { auth, RecaptchaVerifier, signInWithPhoneNumber }
