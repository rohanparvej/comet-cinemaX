# Cinemax

```
cinemax/           static frontend (plain HTML/CSS/JS, no build step, no libraries; uses the browser's fetch)
cinemax-backend/   Express + MongoDB API (see its README for every endpoint)
```

## Run it
1. Start MongoDB locally (or use an Atlas connection string).
2. Backend:
   ```
   cd cinemax-backend
   cp .env.example .env      # set MONGODB_URI and JWT_SECRET
   npm install
   npm run seed              # admin/admin123, alex/alex123, sarah/sarah123 + sample movies
   npm run dev
   ```
3. Open http://localhost:4000 (the backend also serves the frontend) and http://localhost:4000/admin.html

Serving the frontend separately (Live Server etc.)? Set `apiBaseUrl` in `cinemax/js/config.js` to `http://localhost:4000`.

## Frontend layout
```
index.html, admin.html
js/config.js              API address, cutout image
js/services/              api.js (fetch wrapper), session.js (login kept in the browser)
js/components/            navbar, now-playing, polls-reviews, star-rating, auth-modal, dom-helpers
js/admin/                 admin.js (entry), admin-login, admin-choices, admin-winners
js/main.js                loads data from the API, starts the home page components
css/                      tokens/global, components/, sections/, admin.css
```
