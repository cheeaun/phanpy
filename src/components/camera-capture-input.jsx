const isMobileSafari =
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function CameraCaptureInput({
  hidden,
  disabled = false,
  supportedMimeTypes,
  setMediaAttachments,
}) {
  // If not Mobile Safari, only apply image/*
  // Chrome Android doesn't show the camera if image and video combined
  // It also can't switch between photo and video mode like iOS/Safari
  const filteredSupportedMimeTypes = isMobileSafari
    ? supportedMimeTypes
    : supportedMimeTypes?.filter((mimeType) => !/^image\//i.test(mimeType));

  return (
    <input
      type="file"
      hidden={hidden}
      accept={filteredSupportedMimeTypes?.join(',')}
      capture="environment"
      disabled={disabled}
      onChange={(e) => {
        const files = e.target.files;
        if (!files) return;
        const mediaFile = Array.from(files)[0];
        if (!mediaFile) return;
        setMediaAttachments((attachments) => [
          ...attachments,
          {
            file: mediaFile,
            type: mediaFile.type,
            size: mediaFile.size,
            url: URL.createObjectURL(mediaFile),
            id: null, // indicate uploaded state
            description: null,
          },
        ]);
        e.target.value = null;
      }}
    />
  );
}

export const supportsCameraCapture = (() => {
  const input = document.createElement('input');
  return 'capture' in input;
})();

export default CameraCaptureInput;
