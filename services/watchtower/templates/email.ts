import type { Message } from './messages.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SERIF = "Georgia,'Times New Roman',Times,serif";

/** Plain HTML for mail clients: white page, ink text, serif fallback stack (web fonts fail in mail), no images, no accent. */
export const renderEmail = (m: Message) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#ffffff;color:#15181C;font-family:${SERIF};font-size:16px;line-height:1.5">
<div style="max-width:560px">
<h1 style="font-size:20px;font-weight:normal;margin:0 0 16px;color:#15181C">${esc(m.subject)}</h1>
${m.lines.map((l) => `<p style="margin:0 0 12px;color:#15181C">${esc(l)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${esc(m.action.link)}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:2px;font-family:${SERIF}">${esc(m.action.label)}</a></p>
<p style="margin:0;color:#4A5058;font-size:14px">The button opens the app. Heirloom never signs for you.</p>
</div>
</body></html>`;
