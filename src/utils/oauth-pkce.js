function dec2hex(dec) {
  return ('0' + dec.toString(16)).slice(-2);
}
export function verifier() {
  var array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}
function sha256(plain) {
  // returns promise ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}
function base64urlencode(a) {
  let str = '';
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function generateCodeChallenge(v) {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

// If /.well-known/oauth-authorization-server exists and code_challenge_methods_supported includes "S256", means support PKCE
export async function supportsPKCE({ instanceURL }) {
  if (!instanceURL) return false;
  try {
    const res = await fetch(
      `https://${instanceURL}/.well-known/oauth-authorization-server`,
    );
    if (!res.ok || res.status !== 200) return false;
    const json = await res.json();
    if (json.code_challenge_methods_supported?.includes('S256')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// For debugging
window.__generateCodeChallenge = generateCodeChallenge;
