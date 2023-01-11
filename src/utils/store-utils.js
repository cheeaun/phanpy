import store from './store';

export function getCurrentAccount() {
  const accounts = store.local.getJSON('accounts') || [];
  const currentAccount = store.session.get('currentAccount');
  const account =
    accounts.find((a) => a.info.id === currentAccount) || accounts[0];
  return account;
}
