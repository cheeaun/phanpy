import GIFrame from 'giframe';

export async function getGifFirstFrame(gifUrl) {
  try {
    const giframe = new GIFrame(0, {
      usePNG: true,
    });
    const base64Promise = giframe.getBase64();

    const response = await fetch(gifUrl);
    const buf = await response.arrayBuffer();
    giframe.feed(new Uint8Array(buf));

    const base64 = await base64Promise;
    // Convert data URI to blob
    // More memory-efficient if same image is rendered multiple times
    const blob = await (await fetch(base64)).blob();
    const staticUrl = URL.createObjectURL(blob);
    return staticUrl;
  } catch (e) {
    // Fail silently if giframe fails
    return null;
  }
}
