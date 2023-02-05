import store from './store';

export function getAccount(id) {
  const accounts = store.local.getJSON('accounts') || [];
  return accounts.find((a) => a.info.id === id);
}

export function getCurrentAccount() {
  const currentAccount = store.session.get('currentAccount');
  const account = getAccount(currentAccount);
  return account;
}

export function getCurrentAccountNS() {
  const account = getCurrentAccount();
  const {
    instanceURL,
    info: { id },
  } = account;
  return `${id}@${instanceURL}`;
}

export function saveAccount(account) {
  const accounts = store.local.getJSON('accounts') || [];
  const acc = accounts.find((a) => a.info.id === account.info.id);
  if (acc) {
    acc.info = account.info;
    acc.instanceURL = account.instanceURL;
    acc.accessToken = account.accessToken;
  } else {
    accounts.push(account);
  }
  store.local.setJSON('accounts', accounts);
  store.session.set('currentAccount', account.info.id);
}
