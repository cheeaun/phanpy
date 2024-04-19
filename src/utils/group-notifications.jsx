// This is like very lame "type-checking" lol
const notificationTypeKeys = {
  mention: ['account', 'status'],
  status: ['account', 'status'],
  reblog: ['account', 'status'],
  follow: ['account'],
  follow_request: ['account'],
  favourite: ['account', 'status'],
  poll: ['status'],
  update: ['status'],
};
export function fixNotifications(notifications) {
  return notifications.filter((notification) => {
    const { type, id, createdAt } = notification;
    if (!type) {
      console.warn('Notification missing type', notification);
      return false;
    }
    if (!id || !createdAt) {
      console.warn('Notification missing id or createdAt', notification);
      // Continue processing this despite missing id or createdAt
    }
    const keys = notificationTypeKeys[type];
    if (keys?.length) {
      return keys.every((key) => !!notification[key]);
    }
    return true; // skip other types
  });
}

function groupNotifications(notifications) {
  // Filter out invalid notifications
  notifications = fixNotifications(notifications);

  // Create new flat list of notifications
  // Combine sibling notifications based on type and status id
  // Concat all notification.account into an array of _accounts
  const notificationsMap = {};
  const cleanNotifications = [];
  for (let i = 0, j = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    const { id, status, account, type, createdAt } = notification;
    const date = createdAt ? new Date(createdAt).toLocaleDateString() : '';
    let virtualType = type;
    if (type === 'favourite' || type === 'reblog') {
      virtualType = 'favourite+reblog';
    }
    const key = `${status?.id}-${virtualType}-${date}`;
    const mappedNotification = notificationsMap[key];
    if (virtualType === 'follow_request') {
      cleanNotifications[j++] = notification;
    } else if (mappedNotification?.account) {
      const mappedAccount = mappedNotification._accounts.find(
        (a) => a.id === account.id,
      );
      if (mappedAccount) {
        mappedAccount._types.push(type);
        mappedAccount._types.sort().reverse();
        mappedNotification.id += `-${id}`;
      } else {
        account._types = [type];
        mappedNotification._accounts.push(account);
        mappedNotification.id += `-${id}`;
      }
    } else {
      if (account) account._types = [type];
      let n = (notificationsMap[key] = {
        ...notification,
        type: virtualType,
        _accounts: account ? [account] : [],
      });
      cleanNotifications[j++] = n;
    }
  }

  // 2nd pass to group "favourite+reblog"-type notifications by account if _accounts.length <= 1
  // This means one acount has favourited and reblogged the multiple statuses
  // The grouped notification
  // - type: "favourite+reblog+account"
  // - _statuses: [status, status, ...]
  const notificationsMap2 = {};
  const cleanNotifications2 = [];
  for (let i = 0, j = 0; i < cleanNotifications.length; i++) {
    const notification = cleanNotifications[i];
    const { id, account, _accounts, type, createdAt } = notification;
    const date = createdAt ? new Date(createdAt).toLocaleDateString() : '';
    if (type === 'favourite+reblog' && account && _accounts.length === 1) {
      const key = `${account?.id}-${type}-${date}`;
      const mappedNotification = notificationsMap2[key];
      if (mappedNotification) {
        mappedNotification._statuses.push(notification.status);
        mappedNotification.id += `-${id}`;
      } else {
        let n = (notificationsMap2[key] = {
          ...notification,
          type,
          _statuses: [notification.status],
        });
        cleanNotifications2[j++] = n;
      }
    } else {
      cleanNotifications2[j++] = notification;
    }
  }

  console.log({ notifications, cleanNotifications, cleanNotifications2 });

  // return cleanNotifications;
  return cleanNotifications2;
}

export default groupNotifications;
