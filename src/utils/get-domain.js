import punycode from 'punycode/';

export default function getDomain(url) {
  try {
    return punycode.toUnicode(
      URL.parse(url)
        .hostname.replace(/^www\./, '')
        .replace(/\/$/, ''),
    );
  } catch (e) {
    return ''; // just give up
  }
}
