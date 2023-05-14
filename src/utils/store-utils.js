import store from './store';

export function getAccount(id) {
  const accounts = store.local.getJSON('accounts') || [];
  return accounts.find((a) => a.info.id === id) || accounts[0];
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

let currentInstance = null;
export function getCurrentInstance() {
  if (currentInstance) return currentInstance;
  try {
    const account = getCurrentAccount();
    const instances = store.local.getJSON('instances');
    const instance = account.instanceURL.toLowerCase();
    return (currentInstance = instances[instance]);
  } catch (e) {
    console.error(e);
    alert(`Failed to load instance configuration. Please try again.\n\n${e}`);
    // Temporary fix for corrupted data
    store.local.del('instances');
    location.reload();
    return {};
  }
}
