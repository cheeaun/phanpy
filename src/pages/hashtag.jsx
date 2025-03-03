import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  FocusableItem,
  MenuDivider,
  MenuGroup,
  MenuHeader,
  MenuItem,
} from '@szhsin/react-menu';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import Icon from '../components/icon';
import MenuConfirm from '../components/menu-confirm';
import Menu2 from '../components/menu2';
import { SHORTCUTS_LIMIT } from '../components/shortcuts-settings';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import showToast from '../utils/show-toast';
import states, { saveStatus } from '../utils/states';
import { isMediaFirstInstance } from '../utils/store-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

// Limit is 4 per "mode"
// https://github.com/mastodon/mastodon/issues/15194
// Hard-coded https://github.com/mastodon/mastodon/blob/19614ba2477f3d12468f5ec251ce1cc5f8c6210c/app/models/tag_feed.rb#L4
const TAGS_LIMIT_PER_MODE = 4;
const TOTAL_TAGS_LIMIT = TAGS_LIMIT_PER_MODE + 1;

function Hashtags({ media: mediaView, columnMode, ...props }) {
  const { t } = useLingui();
  // const navigate = useNavigate();
  let { hashtag, ...params } = columnMode ? {} : useParams();
  if (props.hashtag) hashtag = props.hashtag;
  let hashtags = hashtag.trim().split(/[\s+]+/);
  hashtags.sort();
  hashtag = hashtags[0];
  const [searchParams, setSearchParams] = useSearchParams();
  const media = mediaView || !!searchParams.get('media');
  const linkParams = media ? '?media=1' : '';

  const { masto, instance, authenticated } = api({
    instance: props?.instance || params.instance,
  });
  const {
    masto: currentMasto,
    instance: currentInstance,
    authenticated: currentAuthenticated,
  } = api();
  const hashtagTitle = hashtags.map((t) => `#${t}`).join(' ');
  const title = instance
    ? media
      ? t`${hashtagTitle} (Media only) on ${instance}`
      : t`${hashtagTitle} on ${instance}`
    : media
      ? t`${hashtagTitle} (Media only)`
      : t`${hashtagTitle}`;
  useTitle(title, `/:instance?/t/:hashtag`);
  const latestItem = useRef();

  const mediaFirst = useMemo(() => isMediaFirstInstance(), []);

  // const hashtagsIterator = useRef();
  const maxID = useRef(undefined);
  async function fetchHashtags(firstLoad) {
    // if (firstLoad || !hashtagsIterator.current) {
    //   hashtagsIterator.current = masto.v1.timelines.tag.$select(hashtag).list({
    //     limit: LIMIT,
    //     any: hashtags.slice(1),
    //   });
    // }
    // const results = await hashtagsIterator.current.next();

    // NOTE: Temporary fix for listHashtag not persisting `any` in subsequent calls.
    const results = await masto.v1.timelines.tag
      .$select(hashtag)
      .list({
        limit: LIMIT,
        any: hashtags.slice(1),
        maxId: firstLoad ? undefined : maxID.current,
        onlyMedia: media ? true : undefined,
      })
      .next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      // value = filteredItems(value, 'public');
      value.forEach((item) => {
        saveStatus(item, instance, {
          skipThreading: media || mediaFirst, // If media view, no need to form threads
        });
      });

      maxID.current = value[value.length - 1].id;
    }
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines.tag
        .$select(hashtag)
        .list({
          limit: 1,
          any: hashtags.slice(1),
          since_id: latestItem.current,
          onlyMedia: media,
        })
        .next();
      let { value } = results;
      const valueContainsLatestItem = value[0]?.id === latestItem.current; // since_id might not be supported
      if (value?.length && !valueContainsLatestItem) {
        value = filteredItems(value, 'public');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const [followUIState, setFollowUIState] = useState('default');
  const [info, setInfo] = useState();
  // Get hashtag info
  useEffect(() => {
    (async () => {
      try {
        const info = await masto.v1.tags.$select(hashtag).fetch();
        console.log(info);
        setInfo(info);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [hashtag]);

  const reachLimit = hashtags.length >= TOTAL_TAGS_LIMIT;

  const [featuredUIState, setFeaturedUIState] = useState('default');
  const [featuredTags, setFeaturedTags] = useState([]);
  const [isFeaturedTag, setIsFeaturedTag] = useState(false);
  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        const featuredTags = await masto.v1.featuredTags.list();
        setFeaturedTags(featuredTags);
        setIsFeaturedTag(
          featuredTags.some(
            (tag) => tag.name.toLowerCase() === hashtag.toLowerCase(),
          ),
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <Timeline
      key={instance + hashtagTitle}
      title={title}
      titleComponent={
        !!instance && (
          <h1 class="header-double-lines">
            <b dir="auto">{hashtagTitle}</b>
            <div>{instance}</div>
          </h1>
        )
      }
      id="hashtag"
      instance={instance}
      emptyText={t`No one has posted anything with this tag yet.`}
      errorText={t`Unable to load posts with this tag`}
      fetchItems={fetchHashtags}
      checkForUpdates={checkForUpdates}
      useItemID
      view={media || mediaFirst ? 'media' : undefined}
      refresh={media}
      // allowFilters
      filterContext="public"
      headerEnd={
        <Menu2
          portal
          setDownOverflow
          overflow="auto"
          // viewScroll="close"
          position="anchor"
          menuButton={
            <button type="button" class="plain">
              <Icon icon="more" size="l" alt={t`More`} />
            </button>
          }
        >
          {!!info && hashtags.length === 1 && (
            <>
              <MenuConfirm
                subMenu
                confirm={info.following}
                confirmLabel={t`Unfollow #${hashtag}?`}
                disabled={followUIState === 'loading' || !authenticated}
                onClick={() => {
                  setFollowUIState('loading');
                  if (info.following) {
                    // const yes = confirm(`Unfollow #${hashtag}?`);
                    // if (!yes) {
                    //   setFollowUIState('default');
                    //   return;
                    // }
                    masto.v1.tags
                      .$select(hashtag)
                      .unfollow()
                      .then(() => {
                        setInfo({ ...info, following: false });
                        showToast(t`Unfollowed #${hashtag}`);
                      })
                      .catch((e) => {
                        alert(e);
                        console.error(e);
                      })
                      .finally(() => {
                        setFollowUIState('default');
                      });
                  } else {
                    masto.v1.tags
                      .$select(hashtag)
                      .follow()
                      .then(() => {
                        setInfo({ ...info, following: true });
                        showToast(t`Followed #${hashtag}`);
                      })
                      .catch((e) => {
                        alert(e);
                        console.error(e);
                      })
                      .finally(() => {
                        setFollowUIState('default');
                      });
                  }
                }}
              >
                {info.following ? (
                  <>
                    <Icon icon="check-circle" />{' '}
                    <span>
                      <Trans>Following…</Trans>
                    </span>
                  </>
                ) : (
                  <>
                    <Icon icon="plus" />{' '}
                    <span>
                      <Trans>Follow</Trans>
                    </span>
                  </>
                )}
              </MenuConfirm>
              <MenuItem
                type="checkbox"
                checked={isFeaturedTag}
                disabled={featuredUIState === 'loading' || !authenticated}
                onClick={() => {
                  setFeaturedUIState('loading');
                  if (isFeaturedTag) {
                    const featuredTagID = featuredTags.find(
                      (tag) => tag.name.toLowerCase() === hashtag.toLowerCase(),
                    ).id;
                    if (featuredTagID) {
                      masto.v1.featuredTags
                        .$select(featuredTagID)
                        .remove()
                        .then(() => {
                          setIsFeaturedTag(false);
                          showToast(t`Unfeatured on profile`);
                          setFeaturedTags(
                            featuredTags.filter(
                              (tag) => tag.id !== featuredTagID,
                            ),
                          );
                        })
                        .catch((e) => {
                          console.error(e);
                        })
                        .finally(() => {
                          setFeaturedUIState('default');
                        });
                    } else {
                      showToast(t`Unable to unfeature on profile`);
                    }
                  } else {
                    masto.v1.featuredTags
                      .create({
                        name: hashtag,
                      })
                      .then((value) => {
                        setIsFeaturedTag(true);
                        showToast(t`Featured on profile`);
                        setFeaturedTags(featuredTags.concat(value));
                      })
                      .catch((e) => {
                        console.error(e);
                      })
                      .finally(() => {
                        setFeaturedUIState('default');
                      });
                  }
                }}
              >
                {isFeaturedTag ? (
                  <>
                    <Icon icon="check-circle" />
                    <span>
                      <Trans>Featured on profile</Trans>
                    </span>
                  </>
                ) : (
                  <>
                    <Icon icon="check-circle" />
                    <span>
                      <Trans>Feature on profile</Trans>
                    </span>
                  </>
                )}
              </MenuItem>
              <MenuDivider />
            </>
          )}
          {!mediaFirst && (
            <>
              <MenuHeader className="plain">
                <Trans>Filters</Trans>
              </MenuHeader>
              <MenuItem
                type="checkbox"
                checked={!!media}
                onClick={() => {
                  if (media) {
                    searchParams.delete('media');
                  } else {
                    searchParams.set('media', '1');
                  }
                  setSearchParams(searchParams);
                }}
              >
                <Icon icon="check-circle" alt="☑️" />{' '}
                <span class="menu-grow">
                  <Trans>Media only</Trans>
                </span>
              </MenuItem>
              <MenuDivider />
            </>
          )}
          <FocusableItem className="menu-field" disabled={reachLimit}>
            {({ ref }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const newHashtag = e.target[0].value?.trim?.();
                  // Use includes but need to be case insensitive
                  if (
                    newHashtag &&
                    !hashtags.some(
                      (t) => t.toLowerCase() === newHashtag.toLowerCase(),
                    )
                  ) {
                    hashtags.push(newHashtag);
                    hashtags.sort();
                    // navigate(
                    //   instance
                    //     ? `/${instance}/t/${hashtags.join('+')}`
                    //     : `/t/${hashtags.join('+')}`,
                    // );
                    location.hash = instance
                      ? `/${instance}/t/${hashtags.join('+')}${linkParams}`
                      : `/t/${hashtags.join('+')}${linkParams}`;
                  }
                }}
              >
                <Icon icon="hashtag" />
                <input
                  ref={ref}
                  type="text"
                  placeholder={
                    reachLimit
                      ? plural(TOTAL_TAGS_LIMIT, {
                          other: 'Max # tags',
                        })
                      : t`Add hashtag`
                  }
                  required
                  autocorrect="off"
                  autocapitalize="off"
                  spellCheck={false}
                  // no spaces, no hashtags
                  pattern="[^#][^\s#]+[^#]"
                  disabled={reachLimit}
                  dir="auto"
                />
              </form>
            )}
          </FocusableItem>
          <MenuGroup takeOverflow>
            {hashtags.map((tag, i) => (
              <MenuItem
                key={tag}
                disabled={hashtags.length === 1}
                onClick={(e) => {
                  hashtags.splice(i, 1);
                  hashtags.sort();
                  // navigate(
                  //   instance
                  //     ? `/${instance}/t/${hashtags.join('+')}`
                  //     : `/t/${hashtags.join('+')}`,
                  // );
                  location.hash = instance
                    ? `/${instance}/t/${hashtags.join('+')}${linkParams}`
                    : `/t/${hashtags.join('+')}${linkParams}`;
                }}
              >
                <Icon icon="x" alt={t`Remove hashtag`} class="danger-icon" />
                <span class="bidi-isolate">
                  <span class="more-insignificant">#</span>
                  {tag}
                </span>
              </MenuItem>
            ))}
          </MenuGroup>
          <MenuDivider />
          <MenuItem
            disabled={!currentAuthenticated}
            onClick={() => {
              if (states.shortcuts.length >= SHORTCUTS_LIMIT) {
                alert(
                  plural(SHORTCUTS_LIMIT, {
                    one: 'Max # shortcut reached. Unable to add shortcut.',
                    other: 'Max # shortcuts reached. Unable to add shortcut.',
                  }),
                );
                return;
              }
              const shortcut = {
                type: 'hashtag',
                hashtag: hashtags.join(' '),
                instance,
                media: media ? 'on' : undefined,
              };
              // Check if already exists
              const exists = states.shortcuts.some(
                (s) =>
                  s.type === shortcut.type &&
                  s.hashtag
                    .split(/[\s+]+/)
                    .sort()
                    .join(' ') ===
                    shortcut.hashtag
                      .split(/[\s+]+/)
                      .sort()
                      .join(' ') &&
                  (s.instance ? s.instance === shortcut.instance : true) &&
                  (s.media ? !!s.media === !!shortcut.media : true),
              );
              if (exists) {
                alert(t`This shortcut already exists`);
              } else {
                states.shortcuts.push(shortcut);
                showToast(t`Hashtag shortcut added`);
              }
            }}
          >
            <Icon icon="shortcut" />{' '}
            <span>
              <Trans>Add to Shortcuts</Trans>
            </span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              let newInstance = prompt(
                t`Enter a new instance e.g. "mastodon.social"`,
              );
              if (!/\./.test(newInstance)) {
                if (newInstance) alert(t`Invalid instance`);
                return;
              }
              if (newInstance) {
                newInstance = newInstance.toLowerCase().trim();
                // navigate(`/${newInstance}/t/${hashtags.join('+')}`);
                location.hash = `/${newInstance}/t/${hashtags.join(
                  '+',
                )}${linkParams}`;
              }
            }}
          >
            <Icon icon="bus" />{' '}
            <span>
              <Trans>Go to another instance…</Trans>
            </span>
          </MenuItem>
          {currentInstance !== instance && (
            <MenuItem
              onClick={() => {
                location.hash = `/${currentInstance}/t/${hashtags.join(
                  '+',
                )}${linkParams}`;
              }}
            >
              <Icon icon="bus" />{' '}
              <small class="menu-double-lines">
                <Trans>
                  Go to my instance (<b>{currentInstance}</b>)
                </Trans>
              </small>
            </MenuItem>
          )}
        </Menu2>
      }
    />
  );
}

export default Hashtags;
