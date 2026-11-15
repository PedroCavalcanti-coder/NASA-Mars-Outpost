import { isIP } from 'node:net';
import { config } from '../config';

/** A mesma política vale para HTTP, polling e o upgrade WebSocket. */
export function originAllowed(origin: string, host?: string) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (config.webOrigins.includes(url.origin)) return true;
    if (host && url.host === host) return true;
    if (config.isProd) return false;
    if (url.hostname === 'localhost' || url.hostname === '[::1]') return true;
    if (isIP(url.hostname) !== 4) return false;
    const [a = 0, b = 0] = url.hostname.split('.').map(Number);
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  } catch {
    return false;
  }
}
