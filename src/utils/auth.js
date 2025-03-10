import { generateCodeChallenge, verifier } from './oauth-pkce';

const {
  DEV,
  PHANPY_CLIENT_NAME: CLIENT_NAME,
  PHANPY_WEBSITE: WEBSITE,
} = import.meta.env;

const SCOPES = 'read write follow push';

/*
  PHANPY_WEBSITE is set to the default official site.
  It's used in pre-built releases, so there's no way to change it dynamically
  without rebuilding.
  Therefore, we can't use it as redirect_uri.
  We only use PHANPY_WEBSITE if it's "same" as current location URL.
  
  Very basic check based on location.hostname for now
*/
const sameSite = WEBSITE
  ? WEBSITE.toLowerCase().includes(location.hostname)
  : false;
const currentLocation = location.origin + location.pathname;
const REDIRECT_URI = DEV || !sameSite ? currentLocation : WEBSITE;

export async function registerApplication({ instanceURL }) {
  const registrationParams = new URLSearchParams({
    client_name: CLIENT_NAME,
    redirect_uris: REDIRECT_URI,
    scopes: SCOPES,
    website: WEBSITE,
  });
  const registrationResponse = await fetch(
    `https://${instanceURL}/api/v1/apps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: registrationParams.toString(),
    },
  );
  const registrationJSON = await registrationResponse.json();
  console.log({ registrationJSON });
  return registrationJSON;
}

export async function getPKCEAuthorizationURL({ instanceURL, client_id }) {
  const codeVerifier = verifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  const authorizationURL = `https://${instanceURL}/oauth/authorize?${params.toString()}`;
  return [authorizationURL, codeVerifier];
}

export async function getAuthorizationURL({ instanceURL, client_id }) {
  const authorizationParams = new URLSearchParams({
    client_id,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    // redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    response_type: 'code',
  });
  const authorizationURL = `https://${instanceURL}/oauth/authorize?${authorizationParams.toString()}`;
  return authorizationURL;
}

export async function getAccessToken({
  instanceURL,
  client_id,
  client_secret,
  code,
  code_verifier,
}) {
  const params = new URLSearchParams({
    client_id,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
    // scope: SCOPES, // Not needed
    // client_secret,
    // code_verifier,
  });
  if (client_secret) {
    params.append('client_secret', client_secret);
  }
  if (code_verifier) {
    params.append('code_verifier', code_verifier);
  }
  const tokenResponse = await fetch(`https://${instanceURL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const tokenJSON = await tokenResponse.json();
  console.log({ tokenJSON });
  return tokenJSON;
}
