import '@github/text-expander-element';

import { useLingui } from '@lingui/react/macro';
import { forwardRef } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import { api } from '../utils/api';
import { langDetector } from '../utils/browser-translator';
import getCustomEmojis from '../utils/custom-emojis';
import emojifyText from '../utils/emojify-text';
import escapeHTML from '../utils/escape-html';
import getDomain from '../utils/get-domain';
import isRTL from '../utils/is-rtl';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';
import urlRegexObj from '../utils/url-regex';

const menu = document.createElement('ul');
menu.role = 'listbox';
menu.className = 'text-expander-menu';

// Set IntersectionObserver on menu, reposition it because text-expander doesn't handle it
const windowMargin = 16;
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const { left, width } = entry.boundingClientRect;
      const { innerWidth } = window;
      if (left + width > innerWidth) {
        const insetInlineStart = isRTL() ? 'right' : 'left';
        menu.style[insetInlineStart] = innerWidth - width - windowMargin + 'px';
      }
    }
  });
});
observer.observe(menu);

// https://github.com/mastodon/mastodon/blob/c03bd2a238741a012aa4b98dc4902d6cf948ab63/app/models/account.rb#L69
const USERNAME_RE = /[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?/i;
const MENTION_RE = new RegExp(
  `(^|[^=\\/\\w])(@${USERNAME_RE.source}(?:@[\\p{L}\\w.-]+[\\w]+)?)`,
  'uig',
);

// AI-generated, all other regexes are too complicated
const HASHTAG_RE = new RegExp(
  `(^|[^=\\/\\w])(#[\\p{L}\\p{N}_]+([\\p{L}\\p{N}_.]+[\\p{L}\\p{N}_]+)?)(?![\\/\\w])`,
  'iug',
);

// https://github.com/mastodon/mastodon/blob/23e32a4b3031d1da8b911e0145d61b4dd47c4f96/app/models/custom_emoji.rb#L31
const SHORTCODE_RE_FRAGMENT = '[a-zA-Z0-9_]{2,}';
const SCAN_RE = new RegExp(
  `(^|[^=\\/\\w])(:${SHORTCODE_RE_FRAGMENT}:)(?=[^A-Za-z0-9_:]|$)`,
  'g',
);

const segmenter = new Intl.Segmenter();

function highlightText(text, { maxCharacters = Infinity }) {
  // Exceeded characters limit
  const { composerCharacterCount } = states;
  if (composerCharacterCount > maxCharacters) {
    // Highlight exceeded characters
    let withinLimitHTML = '',
      exceedLimitHTML = '';
    const htmlSegments = segmenter.segment(text);
    for (const { segment, index } of htmlSegments) {
      if (index < maxCharacters) {
        withinLimitHTML += segment;
      } else {
        exceedLimitHTML += segment;
      }
    }
    if (exceedLimitHTML) {
      exceedLimitHTML =
        '<mark class="compose-highlight-exceeded">' +
        escapeHTML(exceedLimitHTML) +
        '</mark>';
    }
    return escapeHTML(withinLimitHTML) + exceedLimitHTML;
  }

  return escapeHTML(text)
    .replace(urlRegexObj, '$2<mark class="compose-highlight-url">$3</mark>') // URLs
    .replace(MENTION_RE, '$1<mark class="compose-highlight-mention">$2</mark>') // Mentions
    .replace(HASHTAG_RE, '$1<mark class="compose-highlight-hashtag">$2</mark>') // Hashtags
    .replace(
      SCAN_RE,
      '$1<mark class="compose-highlight-emoji-shortcode">$2</mark>',
    ); // Emoji shortcodes
}

function autoResizeTextarea(textarea) {
  if (!textarea) return;
  const { value, offsetHeight, scrollHeight, clientHeight } = textarea;
  if (offsetHeight < window.innerHeight) {
    // NOTE: This check is needed because the offsetHeight return 50000 (really large number) on first render
    // No idea why it does that, will re-investigate in far future
    const offset = offsetHeight - clientHeight;
    const height = value ? scrollHeight + offset + 'px' : null;
    textarea.style.height = height;
  }
}

const detectLangs = async (text) => {
  if (langDetector) {
    const langs = await langDetector.detect(text);
    if (langs?.length) {
      return langs.slice(0, 2).map((lang) => lang.detectedLanguage);
    }
  }
  const { detectAll } = await import('tinyld/light');
  const langs = detectAll(text);
  if (langs?.length) {
    // return max 2
    return langs.slice(0, 2).map((lang) => lang.lang);
  }
  return null;
};

function encodeHTML(str) {
  return str.replace(/[&<>"']/g, function (char) {
    return '&#' + char.charCodeAt(0) + ';';
  });
}

const Textarea = forwardRef((props, ref) => {
  const { t } = useLingui();
  const { masto, instance } = api();
  const [text, setText] = useState(ref.current?.value || '');
  const {
    maxCharacters,
    performSearch = () => {},
    onTrigger = () => {},
    ...textareaProps
  } = props;
  // const snapStates = useSnapshot(states);
  // const charCount = snapStates.composerCharacterCount;

  // const customEmojis = useRef();
  const searcherRef = useRef();
  useEffect(() => {
    getCustomEmojis(instance, masto)
      .then((r) => {
        const [emojis, searcher] = r;
        searcherRef.current = searcher;
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);

  const textExpanderRef = useRef();
  const textExpanderTextRef = useRef('');
  const hasTextExpanderRef = useRef(false);
  useEffect(() => {
    let handleChange,
      handleValue,
      handleCommited,
      handleActivate,
      handleDeactivate;
    if (textExpanderRef.current) {
      handleChange = (e) => {
        // console.log('text-expander-change', e);
        const { key, provide, text } = e.detail;
        textExpanderTextRef.current = text;

        if (text === '') {
          provide(
            Promise.resolve({
              matched: false,
            }),
          );
          return;
        }

        if (key === ':') {
          // const emojis = customEmojis.current.filter((emoji) =>
          //   emoji.shortcode.startsWith(text),
          // );
          const results = searcherRef.current?.search(text, {
            limit: 5,
          });
          let html = '';
          results.forEach(({ item: emoji }) => {
            const { shortcode, url } = emoji;
            html += `
                <li role="option" data-value="${encodeHTML(shortcode)}">
                <img src="${encodeHTML(
                  url,
                )}" width="16" height="16" alt="" loading="lazy" /> 
                ${encodeHTML(shortcode)}
              </li>`;
          });
          html += `<li role="option" data-value="" data-more="${text}">${t`More…`}</li>`;
          // console.log({ emojis, html });
          menu.innerHTML = html;
          provide(
            Promise.resolve({
              matched: results.length > 0,
              fragment: menu,
            }),
          );
          return;
        }

        const type = {
          '@': 'accounts',
          '#': 'hashtags',
        }[key];
        provide(
          new Promise((resolve) => {
            const searchResults = performSearch({
              type,
              q: text,
              limit: 5,
            });
            searchResults.then((value) => {
              if (text !== textExpanderTextRef.current) {
                return;
              }
              console.log({ value, type, v: value[type] });
              const results = value[type] || value;
              console.log('RESULTS', value, results);
              let html = '';
              results.forEach((result) => {
                const {
                  name,
                  avatarStatic,
                  displayName,
                  username,
                  acct,
                  emojis,
                  history,
                  roles,
                  url,
                } = result;
                const displayNameWithEmoji = emojifyText(displayName, emojis);
                const accountInstance = getDomain(url);
                // const item = menuItem.cloneNode();
                if (acct) {
                  html += `
                    <li role="option" data-value="${encodeHTML(acct)}">
                      <span class="avatar">
                        <img src="${encodeHTML(
                          avatarStatic,
                        )}" width="16" height="16" alt="" loading="lazy" />
                      </span>
                      <span>
                        <b>${displayNameWithEmoji || username}</b>
                        <br><span class="bidi-isolate">@${encodeHTML(
                          acct,
                        )}</span>
                        ${
                          roles?.map(
                            (role) => ` <span class="tag collapsed">
                            ${role.name}
                            ${
                              !!accountInstance &&
                              `<span class="more-insignificant">
                                ${accountInstance}
                              </span>`
                            }
                          </span>`,
                          ) || ''
                        }
                      </span>
                    </li>
                  `;
                } else {
                  const total = history?.reduce?.(
                    (acc, cur) => acc + +cur.uses,
                    0,
                  );
                  html += `
                    <li role="option" data-value="${encodeHTML(name)}">
                      <span class="grow">#<b>${encodeHTML(name)}</b></span>
                      ${
                        total
                          ? `<span class="count">${shortenNumber(total)}</span>`
                          : ''
                      }
                    </li>
                  `;
                }
              });
              if (type === 'accounts') {
                html += `<li role="option" data-value="" data-more="${text}">${t`More…`}</li>`;
              }
              menu.innerHTML = html;
              console.log('MENU', results, menu);
              resolve({
                matched: results.length > 0,
                fragment: menu,
              });
            });
          }),
        );
      };

      textExpanderRef.current.addEventListener(
        'text-expander-change',
        handleChange,
      );

      handleValue = (e) => {
        const { key, item } = e.detail;
        const { value, more } = item.dataset;
        if (key === ':') {
          e.detail.value = value ? `:${value}:` : '​'; // zero-width space
          if (more) {
            // Prevent adding space after the above value
            e.detail.continue = true;

            setTimeout(() => {
              onTrigger?.({
                name: 'custom-emojis',
                defaultSearchTerm: more,
              });
            }, 300);
          }
        } else if (key === '@') {
          e.detail.value = value ? `@${value}` : '​'; // zero-width space
          if (more) {
            e.detail.continue = true;
            setTimeout(() => {
              onTrigger?.({
                name: 'mention',
                defaultSearchTerm: more,
              });
            }, 300);
          }
        } else {
          e.detail.value = `${key}${value}`;
        }
      };

      textExpanderRef.current.addEventListener(
        'text-expander-value',
        handleValue,
      );

      handleCommited = (e) => {
        const { input } = e.detail;
        setText(input.value);
        // fire input event
        if (ref.current) {
          const event = new Event('input', { bubbles: true });
          ref.current.dispatchEvent(event);
        }
      };

      textExpanderRef.current.addEventListener(
        'text-expander-committed',
        handleCommited,
      );

      handleActivate = () => {
        hasTextExpanderRef.current = true;
      };

      textExpanderRef.current.addEventListener(
        'text-expander-activate',
        handleActivate,
      );

      handleDeactivate = () => {
        hasTextExpanderRef.current = false;
      };

      textExpanderRef.current.addEventListener(
        'text-expander-deactivate',
        handleDeactivate,
      );
    }

    return () => {
      if (textExpanderRef.current) {
        textExpanderRef.current.removeEventListener(
          'text-expander-change',
          handleChange,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-value',
          handleValue,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-committed',
          handleCommited,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-activate',
          handleActivate,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-deactivate',
          handleDeactivate,
        );
      }
    };
  }, []);

  useEffect(() => {
    // Resize observer for textarea
    const textarea = ref.current;
    if (!textarea) return;
    const resizeObserver = new ResizeObserver(() => {
      // Get height of textarea, set height to textExpander
      if (textExpanderRef.current) {
        const { height } = textarea.getBoundingClientRect();
        textExpanderRef.current.style.height = height + 'px';
      }
    });
    resizeObserver.observe(textarea);
  }, []);

  const slowHighlightPerf = useRef(0); // increment if slow
  const composeHighlightRef = useRef();
  const throttleHighlightText = useThrottledCallback((text) => {
    if (!composeHighlightRef.current) return;
    if (slowHighlightPerf.current > 3) {
      // After 3 times of lag, disable highlighting
      composeHighlightRef.current.innerHTML = '';
      composeHighlightRef.current = null; // Destroy the whole thing
      throttleHighlightText?.cancel?.();
      return;
    }
    let start;
    let end;
    if (slowHighlightPerf.current <= 3) start = Date.now();
    composeHighlightRef.current.innerHTML =
      highlightText(text, {
        maxCharacters,
      }) + '\n';
    if (slowHighlightPerf.current <= 3) end = Date.now();
    console.debug('HIGHLIGHT PERF', { start, end, diff: end - start });
    if (start && end && end - start > 50) {
      // if slow, increment
      slowHighlightPerf.current++;
    }
    // Newline to prevent multiple line breaks at the end from being collapsed, no idea why
  }, 500);

  const debouncedAutoDetectLanguage = useDebouncedCallback(() => {
    // Make use of the highlightRef to get the DOM
    // Clone the dom
    const dom = composeHighlightRef.current?.cloneNode(true);
    if (!dom) return;
    // Remove mark
    dom.querySelectorAll('mark').forEach((mark) => {
      mark.remove();
    });
    const text = dom.innerText?.trim();
    if (!text) return;
    (async () => {
      const langs = await detectLangs(text);
      if (langs?.length) {
        onTrigger?.({
          name: 'auto-detect-language',
          languages: langs,
        });
      }
    })();
  }, 2000);

  return (
    <text-expander
      ref={textExpanderRef}
      keys="@ # :"
      class="compose-field-container"
    >
      <textarea
        class="compose-field"
        autoCapitalize="sentences"
        autoComplete="on"
        autoCorrect="on"
        spellCheck="true"
        dir="auto"
        rows="6"
        cols="50"
        {...textareaProps}
        ref={ref}
        name="status"
        value={text}
        onKeyDown={(e) => {
          // Get line before cursor position after pressing 'Enter'
          const { key, target } = e;
          const hasTextExpander = hasTextExpanderRef.current;
          if (
            key === 'Enter' &&
            !(e.ctrlKey || e.metaKey || hasTextExpander) &&
            !e.isComposing
          ) {
            try {
              const { value, selectionStart } = target;
              const textBeforeCursor = value.slice(0, selectionStart);
              const lastLine = textBeforeCursor.split('\n').slice(-1)[0];
              if (lastLine) {
                // If line starts with "- " or "12. "
                if (/^\s*(-|\d+\.)\s/.test(lastLine)) {
                  // insert "- " at cursor position
                  const [_, preSpaces, bullet, postSpaces, anything] =
                    lastLine.match(/^(\s*)(-|\d+\.)(\s+)(.+)?/) || [];
                  if (anything) {
                    e.preventDefault();
                    const [number] = bullet.match(/\d+/) || [];
                    const newBullet = number ? `${+number + 1}.` : '-';
                    const text = `\n${preSpaces}${newBullet}${postSpaces}`;
                    target.setRangeText(text, selectionStart, selectionStart);
                    const pos = selectionStart + text.length;
                    target.setSelectionRange(pos, pos);
                  } else {
                    // trim the line before the cursor, then insert new line
                    const pos = selectionStart - lastLine.length;
                    target.setRangeText('', pos, selectionStart);
                  }
                  autoResizeTextarea(target);
                  target.dispatchEvent(new Event('input'));
                }
              }
            } catch (e) {
              // silent fail
              console.error(e);
            }
          }
          if (composeHighlightRef.current) {
            composeHighlightRef.current.scrollTop = target.scrollTop;
          }
        }}
        onInput={(e) => {
          const { target } = e;
          const text = target.value;
          setText(text);
          autoResizeTextarea(target);
          props.onInput?.(e);
          throttleHighlightText(text);
          debouncedAutoDetectLanguage();
        }}
        style={{
          width: '100%',
          height: '4em',
          // '--text-weight': (1 + charCount / 140).toFixed(1) || 1,
        }}
        onScroll={(e) => {
          if (composeHighlightRef.current) {
            const { scrollTop } = e.target;
            composeHighlightRef.current.scrollTop = scrollTop;
          }
        }}
      />
      <div
        ref={composeHighlightRef}
        class="compose-highlight"
        aria-hidden="true"
      />
    </text-expander>
  );
});

export default Textarea;
