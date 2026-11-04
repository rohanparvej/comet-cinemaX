// Remembers who is logged in (token + user) in the browser.
// The visitor and the admin use separate sessions so they never mix.
//
//   userSession.load()  -> { token, user } or null
//   userSession.save(token, user)
//   userSession.clear()

function createSession(storageKey) {
  return {
    load: function () {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        return saved && saved.token && saved.user ? saved : null;
      } catch (error) {
        return null;
      }
    },
    save: function (token, user) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ token: token, user: user }));
      } catch (error) {
        // storage blocked: the login just won't survive a page reload
      }
    },
    clear: function () {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        // ignore
      }
    }
  };
}

const userSession = createSession("cinemax_user");
const adminSession = createSession("cinemax_admin");
