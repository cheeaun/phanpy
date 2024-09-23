import getHTMLText from './getHTMLText';

function statusPeek(status) {
  const { spoilerText, content, poll, mediaAttachments } = status;
  let text = '';
  if (spoilerText?.trim()) {
    text += spoilerText;
  } else {
    text += getHTMLText(content);
  }
  text = text.trim();
  if (poll?.options?.length) {
    text += `\n\n📊:\n${poll.options
      .map((o) => `${poll.multiple ? '▪️' : '•'} ${o.title}`)
      .join('\n')}`;
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
