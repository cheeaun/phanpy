import '@github/text-expander-element';

import { useLingui } from '@lingui/react/macro';
import { forwardRef, useImperativeHandle } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';

import { api } from '../utils/api';
import getCustomEmojis from '../utils/custom-emojis';
import emojifyText from '../utils/emojify-text';
import getDomain from '../utils/get-domain';
import isRTL from '../utils/is-rtl';
import shortenNumber from '../utils/shorten-number';

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

function encodeHTML(str) {
  return str.replace(/[&<>"']/g, function (char) {
    return '&#' + char.charCodeAt(0) + ';';
  });
}

function TextExpander({ onTrigger = null, ...props }, ref) {
  const { t } = useLingui();
  const textExpanderRef = useRef();
  const { masto, instance } = api();
  const searcherRef = useRef();
  const textExpanderTextRef = useRef('');
  const hasTextExpanderRef = useRef(false);

  // Expose the activated state to parent components
  useImperativeHandle(ref, () => ({
    setStyle: (style) => {
      if (textExpanderRef.current) {
        Object.assign(textExpanderRef.current.style, style);
      }
    },
    activated: () => hasTextExpanderRef.current,
  }));

  // Setup emoji search if not already set up
  useEffect(() => {
    if (searcherRef.current) return; // Already set up

    getCustomEmojis(instance, masto)
      .then(([, searcher]) => {
        searcherRef.current = searcher;
      })
      .catch((e) => {
        console.error(e);
      });
  }, [instance, masto]);

  useEffect(() => {
    const textExpander = textExpanderRef.current;
    if (!textExpander) return;

    const handleChange = (e) => {
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
        const showMore = !!onTrigger;
        const results = searcherRef.current?.search(text, {
          limit: 5,
        });

        let html = '';
        results?.forEach(({ item: emoji }) => {
          const { shortcode, url } = emoji;
          html += `
            <li role="option" data-value="${encodeHTML(shortcode)}">
              <img src="${encodeHTML(
                url,
              )}" width="16" height="16" alt="" loading="lazy" />
              ${encodeHTML(shortcode)}
            </li>`;
        });
        if (showMore) {
          html += `<li role="option" data-value="" data-more="${text}">${'More…'}</li>`;
        }
        menu.innerHTML = html;

        provide(
          Promise.resolve({
            matched: (results?.length || 0) > 0,
            fragment: menu,
          }),
        );
        return;
      }

      // Handle @ mentions and # hashtags
      const type = {
        '@': 'accounts',
        '#': 'hashtags',
      }[key];

      if (type) {
        provide(
          new Promise(async (resolve) => {
            try {
              let searchResults;
              if (type === 'accounts') {
                searchResults = await masto.v1.accounts.search.list({
                  q: text,
                  limit: 5,
                  resolve: false,
                });
              } else {
                const response = await masto.v2.search.list({
                  type,
                  q: text,
                  limit: 5,
                });
                searchResults = response[type] || response;
              }

              if (text !== textExpanderTextRef.current) {
                return;
              }

              const results = searchResults;
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
              resolve({
                matched: results.length > 0,
                fragment: menu,
              });
            } catch (error) {
              console.error('Search error:', error);
              resolve({
                matched: false,
              });
            }
          }),
        );
        return;
      }

      // No other keys supported
      provide(
        Promise.resolve({
          matched: false,
        }),
      );
    };

    const handleValue = (e) => {
      const { key, item } = e.detail;
      const { value, more } = item.dataset;

      if (key === ':') {
        e.detail.value = value ? `:${value}:` : '​'; // zero-width space
        if (more) {
          // Prevent adding space after the above value
          e.detail.continue = true;

          setTimeout(() => {
            // Trigger custom emoji picker modal for more options
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

    const handleCommited = (e) => {
      const { input } = e.detail;

      if (input) {
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      }
    };

    const handleActivate = () => {
      hasTextExpanderRef.current = true;
    };

    const handleDeactivate = () => {
      hasTextExpanderRef.current = false;
    };

    textExpander.addEventListener('text-expander-change', handleChange);
    textExpander.addEventListener('text-expander-value', handleValue);
    textExpander.addEventListener('text-expander-committed', handleCommited);
    textExpander.addEventListener('text-expander-activate', handleActivate);
    textExpander.addEventListener('text-expander-deactivate', handleDeactivate);

    return () => {
      textExpander.removeEventListener('text-expander-change', handleChange);
      textExpander.removeEventListener('text-expander-value', handleValue);
      textExpander.removeEventListener(
        'text-expander-committed',
        handleCommited,
      );
      textExpander.removeEventListener(
        'text-expander-activate',
        handleActivate,
      );
      textExpander.removeEventListener(
        'text-expander-deactivate',
        handleDeactivate,
      );
    };
  }, [searcherRef.current, onTrigger, t, masto]);

  return <text-expander ref={textExpanderRef} {...props} />;
}

export default forwardRef(TextExpander);
