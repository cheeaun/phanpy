import { useRef } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Timeline from '../components/timeline';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Hashtags() {
  const { hashtag } = useParams();
  useTitle(`#${hashtag}`, `/t/${hashtag}`);
  const hashtagsIterator = useRef();
  async function fetchHashtags(firstLoad) {
    if (firstLoad || !hashtagsIterator.current) {
      hashtagsIterator.current = masto.v1.timelines.listHashtag(hashtag, {
        limit: LIMIT,
      });
    }
    return await hashtagsIterator.current.next();
  }

  return (
    <Timeline
      key={hashtag}
      title={`#${hashtag}`}
      id="hashtags"
      emptyText="No one has posted anything with this tag yet."
      errorText="Unable to load posts with this tag"
      fetchItems={fetchHashtags}
    />
  );
}

export default Hashtags;
