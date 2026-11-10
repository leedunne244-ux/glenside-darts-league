# Glenside Darts League: activate live Excel standings

This is the website source, not a live OneDrive connection. The custom table and Rules & Guide are unchanged.

## Important: deployment
A drag-and-drop static upload may not build the Netlify Function or install the `exceljs` dependency. For the data connection, use a GitHub-connected Netlify deployment (recommended), or a Netlify CLI deployment with function dependencies installed. Simply uploading this ZIP may leave `/api/standings` unavailable.

1. Extract this ZIP. Upload the extracted files to a GitHub repository, preserving `netlify/functions/standings.js`, `package.json` and `netlify.toml`.
2. In Netlify, link the existing `glensidedartsleague` site to the GitHub repository under **Project configuration > Build & deploy > Continuous deployment**, or import the repository as a new site and later assign the desired site name.
3. Under **Project configuration > Environment variables**, add key `ONEDRIVE_DOWNLOAD_URL`. Set its value to your read-only personal OneDrive workbook sharing URL. Do not put it in HTML or a public repository.
4. Deploy the site. In Netlify, confirm that the function `standings` appears in **Logs & metrics > Functions** (menu wording may vary).
5. Open `https://glensidedartsleague.netlify.app/api/standings`. If successful it returns JSON with `table`, `completed`, `scheduled`. If it says `NOT_CONFIGURED`, check the environment variable and redeploy. If it says `WORKBOOK_UNAVAILABLE`, OneDrive is not supplying downloadable XLSX bytes and a different access method is required.
6. On the website, enter a test result in Excel `FIXTURES & RESULTS` columns F/G, save, then refresh the website. It polls every five minutes while open, but a manual refresh requests the newest result immediately.

## Security
The entire workbook may be downloadable by anyone who gets its public sharing link. Avoid storing private data in the shared workbook. This site does not expose the workbook URL in HTML, but Netlify environment variables do not revoke the original sharing permission.

## League logic
16 player slots (`PLAYERS!B5:B20`), dynamic fixture rows starting at row 6, 3 points for a win, 1 for a 2-1 loss, 2 for a walkover win. Rankings by points, wins, leg difference, legs won, then head-to-head. Manual tie-break rematches remain the organiser's responsibility.
