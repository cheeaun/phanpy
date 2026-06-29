import { plural } from '@lingui/core/macro';

function FilePickerInput({
  hidden,
  supportedMimeTypes,
  maxMediaAttachments,
  mediaAttachments,
  disabled = false,
  setMediaAttachments,
}) {
  return (
    <input
      type="file"
      hidden={hidden}
      accept={supportedMimeTypes?.join(',')}
      multiple={
        maxMediaAttachments === undefined ||
        maxMediaAttachments - mediaAttachments >= 2
      }
      disabled={disabled}
      onChange={async (e) => {
        const files = e.target.files;
        if (!files) return;

        let mediaFiles;
        try {
          mediaFiles = await Promise.all(
            Array.from(files).map(async (file) => ({
              fileData: await file.arrayBuffer(),
              fileName: file.name,
              type: file.type,
              size: file.size,
              url: URL.createObjectURL(file),
              id: null, // indicate uploaded state
              description: null,
            })),
          );
        } catch (err) {
          console.error('Failed to read file(s):', err);
          return;
        }
        console.log('MEDIA ATTACHMENTS', files, mediaFiles);

        // Validate max media attachments
        if (mediaAttachments.length + mediaFiles.length > maxMediaAttachments) {
          alert(
            plural(maxMediaAttachments, {
              one: 'You can only attach up to 1 file.',
              other: 'You can only attach up to # files.',
            }),
          );
        } else {
          setMediaAttachments((attachments) => {
            return attachments.concat(mediaFiles);
          });
        }
        // Reset
        e.target.value = '';
      }}
    />
  );
}

export default FilePickerInput;
