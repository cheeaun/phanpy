// Rate limit repeated function calls and queue them to set interval
export default function rateLimit(fn, interval) {
  let queue = [];
  let isRunning = false;

  function executeNext() {
    if (queue.length === 0) {
      isRunning = false;
      return;
    }

    const nextFn = queue.shift();
    nextFn();
    setTimeout(executeNext, interval);
  }

  return function (...args) {
    const callFn = () => fn.apply(this, args);
    queue.push(callFn);

    if (!isRunning) {
      isRunning = true;
      setTimeout(executeNext, interval);
    }
  };
}
