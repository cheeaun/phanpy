import { useMemo } from 'preact/hooks';

import { api } from '../utils/api';

import Link from './link';

const fauxDiv = document.createElement('div');
const HASHTAG_REGEX = /^[#＃][^#＃]+$/;
const ANOTHER_HASHTAG_REGEX = /^[^#＃#️⃣]*[#＃#️⃣]+/;

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  usage: 'search',
});
const isSameTag = (a, b) => collator.compare(a, b) === 0;

const extractTagsFromStatus = (content) => {
  if (!content) return [];
  if (content.indexOf('#') === -1) return [];
  fauxDiv.innerHTML = content;
  const tags = [];

  const allLinks = fauxDiv.querySelectorAll('a[href]');
  for (const link of allLinks) {
    const text = link.textContent.trim();
    const isHashtagLink =
      link.classList.contains('hashtag') || HASHTAG_REGEX.test(text);

    if (isHashtagLink) {
      tags.push(text.replace(ANOTHER_HASHTAG_REGEX, ''));
    }
  }

  return tags;
};

export default function StatusTags({ tags, content }) {
  if (!tags?.length) return null;

  const { instance } = api();

  const tagsToShow = useMemo(() => {
    const hashtagsInContent = extractTagsFromStatus(content);
    if (!hashtagsInContent.length) return tags;
    return tags.filter(
      (tag) => !hashtagsInContent.some((ht) => isSameTag(ht, tag.name)),
    );
  }, [tags, content]);

  if (!tagsToShow.length) return null;

  return (
    <ul class="status-tags">
      {tagsToShow.map((tag) => (
        <li key={tag.name}>
          <Link
            to={
              instance
                ? `/${instance}/t/${encodeURIComponent(tag.name)}`
                : `/t/${encodeURIComponent(tag.name)}`
            }
          >
            <span class="more-insignificant">#</span>
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
