import { useEffect, useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Timeline from '../components/timeline';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Lists() {
  const { id } = useParams();
  const listsIterator = useRef();
  async function fetchLists(firstLoad) {
    if (firstLoad || !listsIterator.current) {
      listsIterator.current = masto.v1.timelines.listList(id, {
        limit: LIMIT,
      });
    }
    return await listsIterator.current.next();
  }

  const [title, setTitle] = useState(`List ${id}`);
  useTitle(title, `/l/${id}`);
  useEffect(() => {
    (async () => {
      try {
        const list = await masto.v1.lists.fetch(id);
        setTitle(list.title);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [id]);

  return (
    <Timeline
      title={title}
      id="lists"
      emptyText="Nothing yet."
      errorText="Unable to load posts."
      fetchItems={fetchLists}
      boostsCarousel
    />
  );
}

export default Lists;
