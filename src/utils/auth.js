import { generateCodeChallenge, verifier } from './oauth-pkce';

const { PHANPY_CLIENT_NAME: CLIENT_NAME, PHANPY_WEBSITE: WEBSITE } = import.meta
  .env;

const SCOPES = 'read write follow push';

export async function registerApplication({ instanceURL }) {
  const registrationParams = new URLSearchParams({
    client_name: CLIENT_NAME,
    redirect_uris: location.origin + location.pathname,
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
    redirect_uri: location.origin + location.pathname,
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
    redirect_uri: location.origin + location.pathname,
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
    redirect_uri: location.origin + location.pathname,
    grant_type: 'authorization_code',
    code,
    scope: SCOPES,
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
