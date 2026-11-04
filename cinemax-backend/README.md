# Cinemax backend (Express + MongoDB)

## Run
```
cp .env.example .env     # set MONGODB_URI and JWT_SECRET
npm install
npm run seed             # admin/admin123, alex/alex123, sarah/sarah123 + 4 poll movies (recommended by alex/sarah) + 1 current winner
npm run dev
```
`npm test` runs a smoke test that needs no database.

## Structure
```
server.js              boot: connect DB, start server
src/app.js             middleware + routes
src/config/            env.js (validated at boot), db.js
src/models/            User, MovieLog, ScreeningChoice, ScreeningWinner
src/routes/            auth, screening, movieLog, admin
src/controllers/       one per route file
src/middleware/        auth (protect/requireAdmin), validate (Joi), error
scripts/seed.js        predefined users + sample data
```

## Collections
Field names match your tables; `inbuilt_id` is Mongo's `_id`, returned as `id`.
- **users**: username*, email, hashed_password*, is_admin*
- **movie_logs**: title_name*, release_year*, added_date_time*, user_id_fk*, rating*, + `comment` (added: the review cards need text)
- **screening_choices**: title_name*, release_year*, recommended_by* (user id, picked from a dropdown by the admin for now), number_of_votes*, chosen_by (array of user ids who voted for it), runtime* (minutes), details, is_deleted
- **screening_winners**: title_name*, release_year*, recommended_by* (user id), is_current*, runtime*, details*, + screening_choice_id_fk, votes_at_declaration. A partial unique index allows only one `is_current: true`.
- **site_images** (new): key, content_type, data (the image bytes), size, updated_by. One document per image slot (`src/config/imageSlots.js`).
Voting is stored in `chosen_by` + `number_of_votes`, so no extra votes collection is needed.

## API
All responses: `{ success, data | message }`. Errors: `{ success: false, message }`. Protected routes take `Authorization: Bearer <token>`.

### Auth
| | |
|---|---|
| POST /api/auth/signup `{username, password}` | **one-time admin setup, backend only (no frontend).** Creates an admin; closes itself after `MAX_BOOTSTRAP_ADMINS` admins exist (default 2); optional `x-setup-key` header if `SETUP_KEY` is set. To remove it: delete `src/routes/bootstrap.routes.js` (nothing else to edit) |
| POST /api/auth/login `{username, password}` | any user |
| POST /api/auth/admin/login `{username, password}` | admins only (403 otherwise) |
| GET /api/auth/me | current user |

### Landing page
| | |
|---|---|
| GET /api/screenings/choices | public. active poll entries: id, title_name, release_year, runtime, number_of_votes, recommended_by `{id, username}` (compare with the logged-in user's id to grey the option out) |
| GET /api/screenings/winner/current | public. the `is_current` winner, or `data: null` |
| GET /api/screenings/votes/me | `{screening_choice_id}` of my vote, or null |
| POST /api/screenings/choices/:id/vote | once only (409 if already voted); 403 on a movie you recommended |
| GET /api/movie-logs?limit=10 | public. recent reviews |
| GET /api/movie-logs/mine | my reviews |
| POST /api/movie-logs `{title_name, release_year, rating (0.5-5, halves), comment?}` | add or update my review |

### Site images (public)
| | |
|---|---|
| GET /api/site/images | `{ max_upload_bytes, images: { now_playing_background: { url, size, updated_at } or null } }` |
| GET /api/site/images/:key | the image itself (cached, with a version in the URL so changes show at once) |

### Admin (admin token)
| | |
|---|---|
| GET /api/admin/users | `[{id, username}]` for the "recommended by" dropdown |
| POST /api/admin/users `{username, password, email?}` | create a normal user account (password stored as a bcrypt hash) |
| GET /api/admin/choices?include_deleted=true | list poll entries |
| POST /api/admin/choices `{title_name, release_year, recommended_by (user id), runtime, details?}` | add entry |
| DELETE /api/admin/choices/:id | soft delete (`is_deleted: true`) |
| GET /api/admin/votes | every entry with its `voters` list (`chosen_by` users) |
| PUT /api/admin/images/:key | upload/replace a site image (multipart, file field `image`; JPG/PNG/WebP up to `MAX_IMAGE_UPLOAD_MB`, default 1). Stored in MongoDB. `:key` = `now_playing_background` |
| DELETE /api/admin/images/:key | remove it (home page goes back to the default background) |
| GET /api/admin/winners | all winners |
| POST /api/admin/winners `{screening_choice_id, details?}` | declare winner: copies the entry into screening_winners, sets it current, turns all others off. `details` required only if the entry has none |
| PATCH /api/admin/winners/:id/current | switch an older winner back on (others go off) |
| DELETE /api/admin/winners/current | turn off all current flags |
