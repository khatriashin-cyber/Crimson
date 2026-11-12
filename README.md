# J.A.R.V.I.S — PWA assistant
1. Install Node 18+. Get a Gemini key at https://aistudio.google.com (free tier has rate limits; paid use is billed by Google).
2. `cp .env.example .env`, paste your key, then `npm start` → http://localhost:3000
3. For Android: deploy to any Node host with HTTPS (PWA install and microphone require HTTPS), open it in Chrome, then menu → Install app.
No npm packages are needed. React is loaded from cdnjs and cached by the service worker. Keys stay server-side in .env.
