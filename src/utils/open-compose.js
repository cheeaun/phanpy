export default function openCompose(opts) {
  const url = new URL('/compose/', window.location);
  const { width: screenWidth, height: screenHeight } = window.screen;
  const left = Math.max(0, (screenWidth - 600) / 2);
  const top = Math.max(0, (screenHeight - 450) / 2);
  const width = Math.min(screenWidth, 600);
  const height = Math.min(screenHeight, 450);
  const winUID = opts?.uid || Math.random();
  const newWin = window.open(
    url,
    'compose' + winUID,
    `width=${width},height=${height},left=${left},top=${top}`,
  );

  if (newWin) {
    // if (masto) {
    //   newWin.masto = masto;
    // }

    newWin.__COMPOSE__ = opts;
  } else {
    alert('Looks like your browser is blocking popups.');
  }

  return newWin;
}
