# Category video data

Each category JSON file contains category metadata and a `videos` array. Replace the empty example object in that category's file with one object per project.

- Paste the YouTube link into `youtubeUrl` (for example, `https://www.youtube.com/watch?v=VIDEO_ID`).
- Put a thumbnail image in `public/images/` and set `thumbnail` to its public path, such as `/images/my-project.jpg`. Leave it empty to use the YouTube thumbnail when a URL is present.
- Fill `title`, `client`, `year`, and `description` only with supplied project information. `id` should be a unique slug within that category.
- Set the category-level `thumbnail` to an image path to use a custom cover on the Work page.

The category registry is `index.js`; add each new category's JSON import there and append it to `categoryFiles`.
