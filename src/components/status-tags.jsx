import { api } from '../utils/api';

import Link from './link';

const fauxDiv = document.createElement('div');
const HASHTAG_REGEX = /^[#＃][^#＃]+$/;
const extractTagsFromStatus = (content) => {
  if (!content) return [];
  if (content.indexOf('#') === -1) return [];
  fauxDiv.innerHTML = content;
  const tags = [];

  const allLinks = fauxDiv.querySelectorAll('a[href]');
  for (const link of allLinks) {
    const text = link.innerText.trim();
    const isHashtagLink =
      link.classList.contains('hashtag') || HASHTAG_REGEX.test(text);

    if (isHashtagLink) {
      tags.push(
        text
          .replace(/^[^#＃#️⃣]*[#＃#️⃣]+/, '')
          .normalize('NFKC')
          .toLowerCase(),
      );
    }
  }

  return tags;
};

export default function StatusTags({ tags, content }) {
  if (!tags?.length) return null;

  const hashtagsInContent = extractTagsFromStatus(content);
  const tagsToShow = tags.filter(
    (tag) =>
      !hashtagsInContent.includes(tag.name.normalize('NFKC').toLowerCase()),
  );

  if (!tagsToShow.length) return null;

  const { instance } = api();

  return (
    <ul class="status-tags">
      {tagsToShow.map((tag) => (
        <li>
          <Link
            to={
              instance
                ? `/${instance}/t/${encodeURIComponent(tag.name)}`
                : `/t/${encodeURIComponent(tag.name)}`
            }
            key={tag.name}
          >
            <span class="more-insignificant">#</span>
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
