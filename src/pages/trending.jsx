import './trending.css';

import { MenuItem } from '@szhsin/react-menu';
import { getBlurHashAverageColor } from 'fast-blurhash';
import { useMemo, useRef, useState } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Menu2 from '../components/menu2';
import RelativeTime from '../components/relative-time';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import pmem from '../utils/pmem';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

const fetchLinks = pmem(
  (masto) => {
    return masto.v1.trends.links.list().next();
  },
  {
    // News last much longer
    maxAge: 10 * 60 * 1000, // 10 minutes
  },
);

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
  const [links, setLinks] = useState([]);
  const trendIterator = useRef();
  async function fetchTrend(firstLoad) {
    if (firstLoad || !trendIterator.current) {
      trendIterator.current = masto.v1.trends.statuses.list({
        limit: LIMIT,
      });

      // Get hashtags
      try {
        const iterator = masto.v1.trends.tags.list();
        const { value: tags } = await iterator.next();
        console.log('tags', tags);
        setHashtags(tags);
      } catch (e) {
        console.error(e);
      }

      // Get links
      try {
        const { value: links } = await fetchLinks(masto);
        console.log('links', links);
        setLinks(links);
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
      const results = await masto.v1.trends.statuses
        .list({
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
    return (
      <>
        {!!hashtags.length && (
          <div class="filter-bar">
            <Icon icon="chart" class="insignificant" size="l" />
            {hashtags.map((tag, i) => {
              const { name, history } = tag;
              const total = history.reduce((acc, cur) => acc + +cur.uses, 0);
              return (
                <Link to={`/${instance}/t/${name}`} key={name}>
                  <span>
                    <span class="more-insignificant">#</span>
                    {name}
                  </span>
                  <span class="filter-count">{total.toLocaleString()}</span>
                </Link>
              );
            })}
          </div>
        )}
        {!!links.length && (
          <div class="links-bar">
            <h3>Trending News</h3>
            {links.map((link) => {
              const {
                authorName,
                authorUrl,
                blurhash,
                description,
                height,
                image,
                imageDescription,
                language,
                providerName,
                providerUrl,
                publishedAt,
                title,
                url,
                width,
              } = link;
              const domain = new URL(url).hostname
                .replace(/^www\./, '')
                .replace(/\/$/, '');
              const averageColor = getBlurHashAverageColor(blurhash);
              const labAverageColor = rgb2oklab(averageColor);

              // const lightColor = averageColor.map((c) => {
              //   const v = c + 120;
              //   return v > 255 ? 255 : v;
              // });
              // const darkColor = averageColor.map((c) => {
              //   const v = c - 100;
              //   return v < 0 ? 0 : v;
              // });
              const lightColor = labAverageColor.map((c, i) => {
                if (i === 0) {
                  return 0.9;
                }
                return c;
              });
              const darkColor = labAverageColor.map((c, i) => {
                if (i === 0) {
                  return 0.4;
                }
                return c;
              });

              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    '--average-color': `rgb(${averageColor?.join(',')})`,
                    // '--light-color': `rgb(${lightColor?.join(',')})`,
                    // '--dark-color': `rgb(${darkColor?.join(',')})`,
                    '--light-color': `oklab(${lightColor?.join(' ')})`,
                    '--dark-color': `oklab(${darkColor?.join(' ')})`,
                  }}
                >
                  <article>
                    <figure>
                      <img
                        src={image}
                        alt={imageDescription}
                        width={width}
                        height={height}
                        loading="lazy"
                      />
                    </figure>
                    <div class="article-body">
                      <header>
                        <div class="article-meta">
                          <span class="domain">{domain}</span>{' '}
                          {!!publishedAt && <>&middot; </>}
                          {!!publishedAt && (
                            <>
                              <RelativeTime
                                datetime={publishedAt}
                                format="micro"
                              />
                            </>
                          )}
                        </div>
                        {!!title && <h1 class="title">{title}</h1>}
                      </header>
                      {!!description && (
                        <p class="description">{description}</p>
                      )}
                    </div>
                  </article>
                </a>
              );
            })}
          </div>
        )}
      </>
    );
  }, [hashtags, links]);

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

function rgb2oklab(rgb) {
  // Normalize RGB values to the range [0, 1]
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;

  // Linearize RGB values
  const rLinear = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Convert to XYZ color space
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175;
  const z = rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041;

  // Normalize to reference white
  const xNormalized = x / 0.95047;
  const yNormalized = y / 1.0;
  const zNormalized = z / 1.08883;

  // Non-linear transfer function for luminance
  const fy =
    yNormalized > 0.008856
      ? Math.cbrt(yNormalized)
      : (903.3 * yNormalized + 16.0) / 116.0;

  // Calculate OkLab values
  const l = Math.max(0, Math.min(1, (116.0 * fy - 16.0) / 100));
  const a = (xNormalized - yNormalized) * 0.21;
  const bValue = (yNormalized - zNormalized) * 0.12;

  return [l, a, bValue];
}

export default Trending;
