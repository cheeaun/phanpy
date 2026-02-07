import { api } from '../utils/api';

import Link from './link';

const fauxDiv = document.createElement('div');
const extractTagsFromStatus = (content) => {
  if (!content) return [];
  if (content.indexOf('#') === -1) return [];
  fauxDiv.innerHTML = content;
  const hashtagLinks = fauxDiv.getElementsByClassName('hashtag');
  if (!hashtagLinks.length) return [];
  const tags = [];
  for (let i = 0; i < hashtagLinks.length; i++) {
    const a = hashtagLinks[i];
    if (a.tagName === 'A') {
      tags.push(
        a.innerText
          .trim()
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
