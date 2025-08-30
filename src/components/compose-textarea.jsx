import { forwardRef } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import { langDetector } from '../utils/browser-translator';
import escapeHTML from '../utils/escape-html';
import states from '../utils/states';
import urlRegexObj from '../utils/url-regex';

import TextExpander from './text-expander';

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

const Textarea = forwardRef((props, ref) => {
  const [text, setText] = useState(ref.current?.value || '');
  const { maxCharacters, onTrigger = null, ...textareaProps } = props;

  const textExpanderRef = useRef();

  useEffect(() => {
    // Resize observer for textarea
    const textarea = ref.current;
    if (!textarea) return;
    const resizeObserver = new ResizeObserver(() => {
      // Get height of textarea, set height to textExpander
      if (textExpanderRef.current) {
        const { height } = textarea.getBoundingClientRect();
        // textExpanderRef.current.style.height = height + 'px';
        textExpanderRef.current.setStyle({ height: height + 'px' });
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
    <TextExpander
      ref={textExpanderRef}
      keys="@ # :"
      class="compose-field-container"
      onTrigger={onTrigger}
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
          const hasTextExpander = textExpanderRef.current?.activated();
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
    </TextExpander>
  );
});

export default Textarea;
