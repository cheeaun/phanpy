import getDomain from '../utils/get-domain';
import { getCurrentAccountID } from '../utils/store-utils';

function RolesTags({ roles, accountId, accountUrl, hideSelf = false }) {
  if (!roles?.length) return null;

  const isSelf = accountId && accountId === getCurrentAccountID();
  if (!accountId && hideSelf) {
    console.warn('accountId is required if hideSelf is true');
  }
  if (hideSelf && isSelf) return null;

  const parsedAccountInstance = getDomain(accountUrl);

  return roles?.map((role) => (
    <>
      {' '}
      <span class="tag collapsed tag-role">
        {role.name}
        {!!parsedAccountInstance && (
          <>
            {' '}
            <span class="more-insignificant">{parsedAccountInstance}</span>
          </>
        )}
      </span>
    </>
  ));
}

export default RolesTags;
