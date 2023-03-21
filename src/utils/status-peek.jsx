import { getHTMLText } from '../components/status';

function statusPeek(status) {
  const { spoilerText, content, poll, mediaAttachments } = status;
  let text = '';
  if (spoilerText?.trim()) {
    text += spoilerText;
  } else {
    text += getHTMLText(content);
  }
  text = text.trim();
  if (poll) {
    text += ' 📊';
  }
  if (mediaAttachments?.length) {
    text +=
      ' ' +
      mediaAttachments
        .map(
          (m) =>
            ({
              image: '🖼️',
              gifv: '🎞️',
              video: '📹',
              audio: '🎵',
              unknown: '',
            }[m.type] || ''),
        )
        .join('');
  }
  return text;
}

export default statusPeek;
