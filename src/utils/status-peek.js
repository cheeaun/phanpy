import getHTMLText from './getHTMLText';

function statusPeek(status) {
  const { spoilerText, content, poll, mediaAttachments, quote } = status;
  let text = '';
  // Don't need supportsNativeQuote because checking quotedStatus ID is enough
  const hasQuote = !!quote?.quotedStatus?.id;
  if (spoilerText?.trim()) {
    text += spoilerText;
  } else {
    text += getHTMLText(content, {
      preProcess: (dom) => {
        if (hasQuote) {
          const reContainer = dom.querySelector('.quote-inline');
          if (reContainer) {
            reContainer.remove();
          }
        }
      },
    });
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
            })[m.type] || '',
        )
        .join('');
  }
  if (hasQuote) {
    const quotePeek = statusPeek(quote.quotedStatus);
    text += `\n\n❝\n${quotePeek}\n❞`;
  }
  return text;
}

export default statusPeek;
