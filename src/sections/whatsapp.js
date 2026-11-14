/*
  WhatsApp-Knöpfe (data-wa): Die fertige Nachricht steht schon im Link (index.html), abgeschickt wird erst,
  wenn der Besucher in WhatsApp auf Senden drückt. Der Link geht direkt auf api.whatsapp.com, weil wa.me beim
  Weiterleiten jedes Emoji zu „�“ macht (geprüft 14.11.2026).
  Am Handy öffnet der Link im selben Tab: so springt er direkt in die App, ohne leeren Tab (iPhone) und ohne
  hängenzubleiben (Instagram, Facebook). Am Computer bleibt der neue Tab für WhatsApp Web.
*/
import { $$ } from '../utils/dom.js';

export function initWhatsApp() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  $$('[data-wa]').forEach((a) => a.removeAttribute('target'));
}
