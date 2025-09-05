import { Trans } from '@lingui/react/macro';
import punycode from 'punycode/';

function AccountHandleInfo({ acct, instance }) {
  // acct = username or username@server
  let [username, server] = acct.split('@');
  if (!server) server = instance;
  const encodedAcct = punycode.toASCII(acct);
  return (
    <div class="handle-info">
      <span class="handle-handle" title={encodedAcct}>
        <b class="handle-username">{username}</b>
        <span class="handle-at">@</span>
        <b class="handle-server">{server}</b>
      </span>
      <div class="handle-legend">
        <span class="ib">
          <span class="handle-legend-icon username" /> <Trans>username</Trans>
        </span>{' '}
        <span class="ib">
          <span class="handle-legend-icon server" />{' '}
          <Trans>server domain name</Trans>
        </span>
      </div>
    </div>
  );
}

export default AccountHandleInfo;
