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

const GROUP_TYPES = ['favourite', 'reblog', 'follow'];
const groupable = (type) => GROUP_TYPES.includes(type);

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

export function massageNotifications2(notifications) {
  if (notifications?.notificationGroups) {
    const {
      accounts = [],
      notificationGroups = [],
      statuses = [],
    } = notifications;
    return notificationGroups.map((group) => {
      const { sampleAccountIds, statusId } = group;
      const sampleAccounts =
        sampleAccountIds?.map((id) => accounts.find((a) => a.id === id)) || [];
      const status = statuses?.find((s) => s.id === statusId) || null;
      return {
        ...group,
        sampleAccounts,
        status,
      };
    });
  }
  return notifications;
}

export function groupNotifications2(groupNotifications) {
  // Make grouped notifications to look like faux grouped notifications
  const newGroupNotifications = groupNotifications.map((gn) => {
    const {
      latestPageNotificationAt,
      mostRecentNotificationId,
      sampleAccounts,
      notificationsCount,
    } = gn;

    return {
      id: '' + mostRecentNotificationId,
      createdAt: latestPageNotificationAt,
      account: sampleAccounts[0],
      ...gn,
    };
  });

  // Merge favourited and reblogged of same status into a single notification
  // - new type: "favourite+reblog"
  // - sum numbers for `notificationsCount` and `sampleAccounts`
  const notificationsMap = {};
  const newGroupNotifications1 = [];
  for (let i = 0; i < newGroupNotifications.length; i++) {
    const gn = newGroupNotifications[i];
    const {
      type,
      status,
      createdAt,
      notificationsCount,
      sampleAccounts,
      groupKey,
    } = gn;
    const date = createdAt ? new Date(createdAt).toLocaleDateString() : '';
    let virtualType = type;
    // const sameCount = notificationsCount > 0 && notificationsCount === sampleAccounts?.length;
    // if (sameCount && (type === 'favourite' || type === 'reblog')) {
    const sampleCountDiffNotificationsCount =
      notificationsCount > 0 &&
      sampleAccounts?.length > 0 &&
      notificationsCount > sampleAccounts?.length;
    if (
      !sampleCountDiffNotificationsCount &&
      (type === 'favourite' || type === 'reblog')
    ) {
      virtualType = 'favourite+reblog';
    }
    // const key = `${status?.id}-${virtualType}-${date}-${sameCount ? 1 : 0}`;
    const key = `${status?.id}-${virtualType}-${date}`;
    const mappedNotification = notificationsMap[key];
    if (!groupable(type)) {
      newGroupNotifications1.push(gn);
    } else if (mappedNotification) {
      // Merge sampleAccounts + merge _types
      sampleAccounts.forEach((a) => {
        const mappedAccount = mappedNotification.sampleAccounts.find(
          (ma) => ma.id === a.id,
        );
        if (!mappedAccount) {
          mappedNotification.sampleAccounts.push({
            ...a,
            _types: [type],
          });
        } else {
          mappedAccount._types.push(type);
          mappedAccount._types.sort().reverse();
        }
      });
      // mappedNotification.notificationsCount =
      //   mappedNotification.sampleAccounts.length;
      mappedNotification.notificationsCount = Math.min(
        mappedNotification.notificationsCount,
        notificationsCount,
      );
      mappedNotification._notificationsCount.push(notificationsCount);
      mappedNotification._sampleAccountsCount.push(sampleAccounts?.length);
      mappedNotification._accounts = mappedNotification.sampleAccounts;
      mappedNotification._groupKeys.push(groupKey);
    } else {
      const accounts = sampleAccounts.map((a) => ({
        ...a,
        _types: [type],
      }));
      notificationsMap[key] = {
        ...gn,
        sampleAccounts: accounts,
        type: virtualType,
        _accounts: accounts,
        _groupKeys: groupKey ? [groupKey] : [],
        _notificationsCount: [notificationsCount],
        _sampleAccountsCount: [sampleAccounts?.length],
      };
      newGroupNotifications1.push(notificationsMap[key]);
    }
  }

  // 2nd pass.
  // - Group 1 account favourte/reblog multiple posts
  // - _statuses: [status, status, ...]
  const notificationsMap2 = {};
  const newGroupNotifications2 = [];
  for (let i = 0; i < newGroupNotifications1.length; i++) {
    const gn = newGroupNotifications1[i];
    const { type, account, _accounts, sampleAccounts, createdAt, groupKey } =
      gn;
    const date = createdAt ? new Date(createdAt).toLocaleDateString() : '';
    const hasOneAccount =
      sampleAccounts?.length === 1 || _accounts?.length === 1;
    if (
      (type === 'favourite' ||
        type === 'reblog' ||
        type === 'favourite+reblog') &&
      hasOneAccount
    ) {
      const key = `${account?.id}-${type}-${date}`;
      const mappedNotification = notificationsMap2[key];
      if (mappedNotification) {
        mappedNotification._statuses.push(gn.status);
        mappedNotification._ids += `-${gn.id}`;
        mappedNotification._groupKeys.push(groupKey);
      } else {
        let n = (notificationsMap2[key] = {
          ...gn,
          type,
          _ids: gn.id,
          _statuses: [gn.status],
          _groupKeys: groupKey ? [groupKey] : [],
        });
        newGroupNotifications2.push(n);
      }
    } else {
      newGroupNotifications2.push(gn);
    }
  }

  console.log('newGroupNotifications2', newGroupNotifications2);

  return newGroupNotifications2;
}

export default function groupNotifications(notifications) {
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
    if (!groupable(type)) {
      cleanNotifications[j++] = notification;
    } else if (mappedNotification?.account) {
      const mappedAccount = mappedNotification._accounts.find(
        (a) => a.id === account.id,
      );
      if (mappedAccount) {
        mappedAccount._types.push(type);
        mappedAccount._types.sort().reverse();
        mappedNotification._ids += `-${id}`;
      } else {
        account._types = [type];
        mappedNotification._accounts.push(account);
        mappedNotification._ids += `-${id}`;
      }
    } else {
      if (account) account._types = [type];
      let n = (notificationsMap[key] = {
        ...notification,
        type: virtualType,
        _ids: id,
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
        mappedNotification._ids += `-${id}`;
      } else {
        let n = (notificationsMap2[key] = {
          ...notification,
          type,
          _ids: id,
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
