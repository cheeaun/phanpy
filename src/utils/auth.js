const { VITE_CLIENT_NAME: CLIENT_NAME, VITE_WEBSITE: WEBSITE } = import.meta
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
}) {
  const params = new URLSearchParams({
    client_id,
    client_secret,
    redirect_uri: location.origin + location.pathname,
    grant_type: 'authorization_code',
    code,
    scope: SCOPES,
  });
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
