// Custom-built version of exifreader, config is in package.json
import ExifReader from 'exifreader/dist/exif-reader.js';

// Tags from IPTC, XMP, EXIF
const TAG_NAMES = ['Caption/Abstract', 'Description', 'ImageDescription'];

export default async function extractImageDescription(file) {
  if (!file || !file.type?.startsWith?.('image/')) return null;

  try {
    const tags = await ExifReader.load(file);
    for (const name of TAG_NAMES) {
      if (tags[name]?.description) {
        return tags[name].description.trim();
      }
    }
    return null;
  } catch (error) {
    console.debug('Failed to extract image description:', error);
    return null;
  }
}
