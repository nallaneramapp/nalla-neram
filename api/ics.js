// POST /api/ics  — echoes an iCalendar file back with the right headers.
//
// Why this exists: iOS Safari won't reliably download a client-generated .ics
// (it ignores the download attribute, and same-tab data: URIs "disappear").
// The dependable fix is to hand the browser a real HTTP response with
// Content-Type: text/calendar + Content-Disposition — iOS then opens the native
// "Add to Calendar" sheet. This route is stateless: the browser sends the .ics
// text it already built, and we just return it with the correct headers.
//
// The site calls this only when window.NN_CONFIG.icsEndpoint === true.
// Deploy this file, then flip that flag in index.html.

export default function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  // Vercel parses application/x-www-form-urlencoded into req.body.
  const ics = (req.body && req.body.ics) || '';
  let name = (req.body && req.body.name) || 'nalla-neram.ics';
  name = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');            // sanitize filename
  if (!/\.ics$/i.test(name)) name += '.ics';

  // Basic sanity so this can't be abused to serve arbitrary content.
  if (!ics.startsWith('BEGIN:VCALENDAR') || ics.length > 200000) {
    res.status(400).send('Invalid calendar');
    return;
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(ics);
}
