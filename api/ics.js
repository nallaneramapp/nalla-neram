// GET (or POST) /api/ics  — echoes an iCalendar file back with the right headers.
//
// Why this exists: iOS Safari won't reliably download a client-generated .ics.
// The dependable fix is a real HTTP response with Content-Type: text/calendar +
// Content-Disposition — iOS then opens the native "Add to Calendar" sheet.
//
// IMPORTANT: it must answer GET. iOS shows a "download this calendar file?"
// prompt and, when the user taps Continue, RE-FETCHES the URL with a GET. A
// POST-only route returns 405 "Method not allowed" at that step. So the site
// calls this as GET with the calendar text base64-encoded in the `c` query
// param (and POST is kept as a fallback).
//
// The site calls this only when window.NN_CONFIG.icsEndpoint === true.

export default function handler(req, res) {
  let ics = '';
  let name = 'nalla-neram.ics';

  if (req.method === 'GET') {
    const c = (req.query && req.query.c) || '';
    if (req.query && req.query.name) name = req.query.name;
    try { ics = Buffer.from(String(c), 'base64').toString('utf8'); } catch (e) { ics = ''; }
  } else if (req.method === 'POST') {
    ics = (req.body && req.body.ics) || '';
    if (req.body && req.body.name) name = req.body.name;
  } else {
    res.status(405).send('Method not allowed');
    return;
  }

  name = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');            // sanitize filename
  if (!/\.ics$/i.test(name)) name += '.ics';

  // Sanity: only serve real calendar payloads, capped in size.
  if (!ics.startsWith('BEGIN:VCALENDAR') || ics.length > 200000) {
    res.status(400).send('Invalid calendar');
    return;
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(ics);
}
