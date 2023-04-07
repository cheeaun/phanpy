import { Menu, MenuItem } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Trending(props) {
  const snapStates = useSnapshot(states);
  const params = useParams();
  const { masto, instance } = api({
    instance: props?.instance || params.instance,
  });
  const title = `Trending (${instance})`;
  useTitle(title, `/:instance?/trending`);
  const navigate = useNavigate();
  const latestItem = useRef();

  const trendIterator = useRef();
  async function fetchTrend(firstLoad) {
    if (firstLoad || !trendIterator.current) {
      trendIterator.current = masto.v1.trends.listStatuses({
        limit: LIMIT,
      });
    }
    const results = await trendIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      value = filteredItems(value, 'public'); // Might not work here
      value.forEach((item) => {
        saveStatus(item, instance);
      });
    }
    return results;
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.trends
        .listStatuses({
          limit: 1,
          // NOT SUPPORTED
          // since_id: latestItem.current,
        })
        .next();
      let { value } = results;
      value = filteredItems(value, 'public');
      if (value?.length && value[0].id !== latestItem.current) {
        latestItem.current = value[0].id;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return (
    <Timeline
      key={instance}
      title={title}
      titleComponent={
        <h1 class="header-account">
          <b>Trending</b>
          <div>{instance}</div>
        </h1>
      }
      id="trending"
      instance={instance}
      emptyText="No trending posts."
      errorText="Unable to load posts"
      fetchItems={fetchTrend}
      checkForUpdates={checkForUpdates}
      checkForUpdatesInterval={5 * 60 * 1000} // 5 minutes
      useItemID
      headerStart={<></>}
      boostsCarousel={snapStates.settings.boostsCarousel}
      allowFilters
      headerEnd={
        <Menu
          portal={{
            target: document.body,
          }}
          // setDownOverflow
          overflow="auto"
          viewScroll="close"
          position="anchor"
          boundingBoxPadding="8 8 8 8"
          menuButton={
            <button type="button" class="plain">
              <Icon icon="more" size="l" />
            </button>
          }
        >
          <MenuItem
            onClick={() => {
              let newInstance = prompt(
                'Enter a new instance e.g. "mastodon.social"',
              );
              if (!/\./.test(newInstance)) {
                if (newInstance) alert('Invalid instance');
                return;
              }
              if (newInstance) {
                newInstance = newInstance.toLowerCase().trim();
                navigate(`/${newInstance}/trending`);
              }
            }}
          >
            <Icon icon="bus" /> <span>Go to another instance…</span>
          </MenuItem>
        </Menu>
      }
    />
  );
}

export default Trending;
