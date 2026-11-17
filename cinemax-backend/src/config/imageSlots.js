// The places on the site where an admin can upload an image.
// To add one (e.g. a poster), add a line here and a matching entry in
// cinemax/js/admin/admin-images.js. key -> label
export const IMAGE_SLOTS = {
  now_playing_background: 'Now Playing background',
  hero_background: 'Hero background',
  // The two poll boxes. Fixed slots = never more than 2 posters; uploading again replaces the old one.
  poll_poster_1: 'Poll poster 1',
  poll_poster_2: 'Poll poster 2',
};