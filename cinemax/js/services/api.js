// The only place that talks to the backend. Uses the browser's fetch (no libraries).
//
//   apiRequest("/api/screenings/choices")
//   apiRequest("/api/movie-logs", { method: "POST", body: { ... }, session: userSession })
//
// A body that is FormData (a file upload) is sent as is.
// Pass a session (see session.js) to send its token. If the server says the
// token is no longer valid (401) the session is cleared and error.unauthorized is true.
// Every failure throws an ApiError with a readable message.

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.unauthorized = false;
  }
}

async function apiRequest(path, options) {
  options = options || {};
  const headers = {};
  const hasBody = options.body !== undefined;
  // A FormData body (file upload) is sent as is; the browser sets its own Content-Type
  const isUpload = hasBody && options.body instanceof FormData;
  if (hasBody && !isUpload) headers["Content-Type"] = "application/json";

  const loggedIn = options.session ? options.session.load() : null;
  if (loggedIn) headers.Authorization = "Bearer " + loggedIn.token;

  let response;
  try {
    response = await fetch(CINEMAX_CONFIG.apiBaseUrl + path, {
      method: options.method || "GET",
      headers: headers,
      body: hasBody ? (isUpload ? options.body : JSON.stringify(options.body)) : undefined
    });
  } catch (error) {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    // no JSON body
  }

  if (!response.ok) {
    const message = (json && json.message) || "Request failed (" + response.status + ").";
    const failure = new ApiError(message, response.status);
    if (response.status === 401 && options.session && loggedIn) {
      options.session.clear();
      failure.unauthorized = true;
    }
    throw failure;
  }
  return json;
}
