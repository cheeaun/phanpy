import { useRef } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Hashtags(props) {
  let { hashtag, ...params } = useParams();
  if (props.hashtag) hashtag = props.hashtag;
  const { masto, instance } = api({ instance: params.instance });
  const title = instance ? `#${hashtag} on ${instance}` : `#${hashtag}`;
  useTitle(title, `/:instance?/t/:hashtag`);
  const latestItem = useRef();

  const hashtagsIterator = useRef();
  async function fetchHashtags(firstLoad) {
    if (firstLoad || !hashtagsIterator.current) {
      hashtagsIterator.current = masto.v1.timelines.listHashtag(hashtag, {
        limit: LIMIT,
      });
    }
    const results = await hashtagsIterator.current.next();
    const { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }
    }
    return results;
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines
        .listHashtag(hashtag, {
          limit: 1,
          since_id: latestItem.current,
        })
        .next();
      const { value } = results;
      if (value?.length) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return (
    <Timeline
      key={hashtag}
      title={title}
      titleComponent={
        !!instance && (
          <h1 class="header-account">
            <b>#{hashtag}</b>
            <div>{instance}</div>
          </h1>
        )
      }
      id="hashtags"
      instance={instance}
      emptyText="No one has posted anything with this tag yet."
      errorText="Unable to load posts with this tag"
      fetchItems={fetchHashtags}
      checkForUpdates={checkForUpdates}
    />
  );
}

export default Hashtags;
