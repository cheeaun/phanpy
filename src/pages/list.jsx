import { useEffect, useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Icon from '../components/icon';
import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function List(props) {
  const { masto, instance } = api();
  const id = props?.id || useParams()?.id;
  const latestItem = useRef();

  const listIterator = useRef();
  async function fetchList(firstLoad) {
    if (firstLoad || !listIterator.current) {
      listIterator.current = masto.v1.timelines.listList(id, {
        limit: LIMIT,
      });
    }
    const results = await listIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
    }
    return results;
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines.listList(id, {
        limit: 1,
        since_id: latestItem.current,
      });
      let { value } = results;
      value = filteredItems(value, 'home');
      if (value?.length) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const [title, setTitle] = useState(`List`);
  useTitle(title, `/l/:id`);
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
      id="list"
      emptyText="Nothing yet."
      errorText="Unable to load posts."
      instance={instance}
      fetchItems={fetchList}
      checkForUpdates={checkForUpdates}
      useItemID
      boostsCarousel
      allowFilters
      headerStart={
        <Link to="/l" class="button plain">
          <Icon icon="list" size="l" />
        </Link>
      }
    />
  );
}

export default List;
