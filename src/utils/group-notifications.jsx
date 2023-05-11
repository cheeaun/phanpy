function groupNotifications(notifications) {
  // Create new flat list of notifications
  // Combine sibling notifications based on type and status id
  // Concat all notification.account into an array of _accounts
  const notificationsMap = {};
  const cleanNotifications = [];
  for (let i = 0, j = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    const { status, account, type, createdAt } = notification;
    const date = new Date(createdAt).toLocaleDateString();
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
      } else {
        account._types = [type];
        mappedNotification._accounts.push(account);
      }
    } else {
      account._types = [type];
      let n = (notificationsMap[key] = {
        ...notification,
        type: virtualType,
        _accounts: [account],
      });
      cleanNotifications[j++] = n;
    }
  }
  return cleanNotifications;
}

export default groupNotifications;
