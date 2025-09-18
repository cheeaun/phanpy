import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import enhanceContent from '../utils/enhance-content';
import handleContentLinks from '../utils/handle-content-links';
import states, { statusKey } from '../utils/states';

const HTTP_REGEX = /^http/i;

const PostContent =
  /*memo(*/
  ({ post, instance, previewMode }) => {
    const { content, emojis, language, mentions, url } = post;
    const snapStates = useSnapshot(states);
    const sKey = statusKey(post.id, instance);
    const quotes = snapStates.statusQuotes[sKey];

    const divRef = useRef();
    useLayoutEffect(() => {
      if (!divRef.current) return;
      const dom = enhanceContent(content, {
        emojis,
        returnDOM: true,
      });
      // Remove target="_blank" from links
      for (const a of dom.querySelectorAll('a.u-url[target="_blank"]')) {
        if (!HTTP_REGEX.test(a.innerText.trim())) {
          a.removeAttribute('target');
        }
      }
      divRef.current.replaceChildren(dom.cloneNode(true));
    }, [content, emojis?.length]);

    useEffect(() => {
      // Find all links that's in states.statusQuotes and add 'is-quote' class
      if (quotes?.length) {
        for (const a of divRef.current.querySelectorAll('a')) {
          if (quotes.some((quote) => quote?.originalURL === a.href)) {
            a.classList.add('is-quote');
          }
        }
      }
    }, [quotes?.length]);

    return (
      <div
        ref={divRef}
        lang={language}
        dir="auto"
        class="inner-content"
        onClick={handleContentLinks({
          mentions,
          instance,
          previewMode,
          statusURL: url,
        })}
        // dangerouslySetInnerHTML={{
        //   __html: enhanceContent(content, {
        //     emojis,
        //     postEnhanceDOM: (dom) => {
        //       // Remove target="_blank" from links
        //       dom.querySelectorAll('a.u-url[target="_blank"]').forEach((a) => {
        //         if (!/http/i.test(a.innerText.trim())) {
        //           a.removeAttribute('target');
        //         }
        //       });
        //     },
        //   }),
        // }}
      />
    );
  }; /*,
  (oldProps, newProps) => {
    const { post: oldPost } = oldProps;
    const { post: newPost } = newProps;
    return oldPost.content === newPost.content;
  },
);*/

export default PostContent;
