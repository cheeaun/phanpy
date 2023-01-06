// Video component but allow muted attribute to be set
import { useEffect, useRef } from 'react';

function Video({ muted, autoplay, ...props }) {
  const videoRef = useRef();
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setAttribute('muted', muted);
      videoRef.current.setAttribute('autoplay', autoplay);
      videoRef.current.play();
    }
  }, [muted]);

  return <video ref={videoRef} {...props} />;
}

export default Video;
