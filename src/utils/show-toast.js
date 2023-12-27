import Toastify from 'toastify-js';

window._showToast = showToast;

function showToast(props) {
  if (typeof props === 'string') {
    props = { text: props };
  }
  const { onClick, delay, ...rest } = props;
  const toast = Toastify({
    className: `${onClick || props.destination ? 'shiny-pill' : ''}`,
    gravity: 'bottom',
    position: 'center',
    ...rest,
    onClick: () => {
      onClick?.(toast); // Pass in the object itself!
    },
  });
  if (delay) {
    setTimeout(() => {
      toast.showToast();
    }, delay);
  } else {
    toast.showToast();
  }
  return toast;
}

export default showToast;
