import { Menu, MenuItem } from '@szhsin/react-menu';
import { useMemo, useRef, useState } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Menu2 from '../components/menu2';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Trending({ columnMode, ...props }) {
  const snapStates = useSnapshot(states);
  const params = columnMode ? {} : useParams();
  const { masto, instance } = api({
    instance: props?.instance || params.instance,
  });
  const title = `Trending (${instance})`;
  useTitle(title, `/:instance?/trending`);
  // const navigate = useNavigate();
  const latestItem = useRef();

  const [hashtags, setHashtags] = useState([]);
  const trendIterator = useRef();
  async function fetchTrend(firstLoad) {
    if (firstLoad || !trendIterator.current) {
      trendIterator.current = masto.v1.trends.listStatuses({
        limit: LIMIT,
      });

      // Get hashtags
      try {
        const iterator = masto.v1.trends.listTags();
        const { value: tags } = await iterator.next();
        console.log(tags);
        setHashtags(tags);
      } catch (e) {
        console.error(e);
      }
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
    return {
      ...results,
      value,
    };
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

  const TimelineStart = useMemo(() => {
    if (!hashtags.length) return null;
    return (
      <div class="filter-bar">
        <Icon icon="chart" class="insignificant" size="l" />
        {hashtags.map((tag, i) => {
          const { name, history } = tag;
          const total = history.reduce((acc, cur) => acc + +cur.uses, 0);
          return (
            <Link to={`/${instance}/t/${name}`}>
              <span>
                <span class="more-insignificant">#</span>
                {name}
              </span>
              <span class="filter-count">{total.toLocaleString()}</span>
            </Link>
          );
        })}
      </div>
    );
  }, [hashtags]);

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
      timelineStart={TimelineStart}
      headerEnd={
        <Menu2
          portal
          // setDownOverflow
          overflow="auto"
          viewScroll="close"
          position="anchor"
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
                // navigate(`/${newInstance}/trending`);
                location.hash = `/${newInstance}/trending`;
              }
            }}
          >
            <Icon icon="bus" /> <span>Go to another instance…</span>
          </MenuItem>
        </Menu2>
      }
    />
  );
}

export default Trending;
