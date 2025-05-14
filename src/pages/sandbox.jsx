import './sandbox.css';

import { useEffect, useState } from 'preact/hooks';

import testGIFURL from '../assets/sandbox/big-buck-bunny-muted.webm';
import testPreviewURL from '../assets/sandbox/big-buck-bunny-preview.png';
import testAudioURL from '../assets/sandbox/big-buck-bunny.mp3';
import testVideoURL from '../assets/sandbox/big-buck-bunny.webm';

import Status from '../components/status';
import { getPreferences } from '../utils/api';
import FilterContext from '../utils/filter-context';
import states from '../utils/states';
import store from '../utils/store';

function hashID(obj) {
  if (!obj) return '';
  if (typeof obj !== 'object') return String(obj);
  return Object.entries(obj)
    .map(([k, v]) =>
      typeof v === 'object' && !Array.isArray(v)
        ? `${k}:${hashID(v)}`
        : `${k}:${v}`,
    )
    .join('|');
}

const MOCK_STATUS = ({ toggles = {} } = {}) => {
  console.log('toggles', toggles);
  const {
    loading,
    mediaFirst,
    contentType,
    contentFormat,
    spoiler,
    spoilerType,
    mediaCount,
    pollCount,
    pollMultiple,
    pollExpired,
    showCard,
    size,
    filters,
    userPreferences,
  } = toggles;

  const shortContent = 'This is a test status with short text content.';
  const longContent = `<p>This is a test status with long text content. It contains multiple paragraphs and spans several lines to demonstrate how longer content appears.</p>
  
  <p>Second paragraph goes here with more sample text. The Status component will render this appropriately based on the current size setting.</p>
  
  <p>Third paragraph adds even more content to ensure we have a properly long post that might get truncated depending on the view settings.</p>`;
  const linksContent = `<p>This is a test status with links. Check out <a href="https://example.com">this website</a> and <a href="https://google.com">Google</a>. Links should be clickable and properly styled.</p>`;
  const hashtagsContent = `<p>This is a test status with hashtags. <a href="https://example.social/tags/coding" class="hashtag" rel="tag">#coding</a> <a href="https://example.social/tags/webdev" class="hashtag" rel="tag">#webdev</a> <a href="https://example.social/tags/javascript" class="hashtag" rel="tag">#javascript</a> <a href="https://example.social/tags/reactjs" class="hashtag" rel="tag">#reactjs</a> <a href="https://example.social/tags/preact" class="hashtag" rel="tag">#preact</a></p><p>Hashtags should be formatted and clickable.</p>`;
  const mentionsContent = `<p>This is a test status with mentions. Hello <a href="https://example.social/@cheeaun" class="u-url mention">@cheeaun</a> and <a href="https://example.social/@test" class="u-url mention">@test</a>! What do you think about this <a href="https://example.social/@another_user" class="u-url mention">@another_user</a>?</p><p>Mentions should be highlighted and clickable.</p>`;

  const base = {
    // Random ID to un-memoize Status
    id: hashID(toggles),
    account: {
      username: 'test',
      name: 'Test',
      // avatar: 'https://picsum.photos/seed/avatar/200',
      avatar: '/logo-192.png',
      acct: 'test@localhost',
      url: 'https://test.localhost',
    },
    content:
      contentFormat === 'text'
        ? contentType === 'long'
          ? longContent
          : contentType === 'links'
            ? linksContent
            : contentType === 'hashtags'
              ? hashtagsContent
              : contentType === 'mentions'
                ? mentionsContent
                : shortContent
        : '',
    visibility: 'public',
    createdAt: new Date().toISOString(),
    reblogsCount: 0,
    favouritesCount: 0,
    repliesCount: 5,
    emojis: [],
    mentions: [],
    tags: [],
    mediaAttachments: [],
  };

  // Add media if selected
  if (mediaCount > 0) {
    base.mediaAttachments = Array(parseInt(mediaCount, 10))
      .fill(0)
      .map((_, i) => {
        const mediaType = toggles.mediaTypes?.[i] || 'image';

        // Configure media based on type
        let mediaConfig = {
          id: `media-${i}`,
          type: mediaType,
          description:
            i % 2 === 0
              ? `Sample ${mediaType} description for media ${i + 1}`
              : '',
        };

        // Set URLs based on media type
        switch (mediaType) {
          case 'image':
            mediaConfig.url = `https://picsum.photos/seed/media-${i}/600/400`;
            mediaConfig.previewUrl = `https://picsum.photos/seed/media-${i}/300/200`;
            mediaConfig.meta = {
              original: {
                width: 600,
                height: 400,
              },
              small: {
                width: 300,
                height: 200,
              },
            };
            break;
          case 'gifv':
            mediaConfig.type = 'gifv';
            mediaConfig.url = testGIFURL;
            mediaConfig.previewUrl = testPreviewURL;
            mediaConfig.meta = {
              original: {
                width: 426,
                height: 240,
                duration: 14,
              },
            };
            break;
          case 'video':
            mediaConfig.type = 'video';
            mediaConfig.url = testVideoURL;
            mediaConfig.previewUrl = testPreviewURL;
            break;
          case 'audio':
            mediaConfig.type = 'audio';
            mediaConfig.url = testAudioURL;
            mediaConfig.previewUrl = i % 2 === 0 ? '' : testPreviewURL;
            break;
        }

        return mediaConfig;
      });
  }

  // Add poll if selected
  if (pollCount > 0) {
    base.poll = {
      id: 'poll-1',
      options: Array(parseInt(pollCount, 10))
        .fill(0)
        .map((_, i) => ({
          title: `Option ${i + 1}`,
          votesCount: Math.floor(Math.random() * 100),
        })),
      // Set expiration date in the past if poll is expired, otherwise in the future
      expiresAt: pollExpired
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      expired: pollExpired,
      multiple: pollMultiple,
      // Use votersCount for multiple-choice polls, votesCount for single-choice polls
      votesCount: 150,
      votersCount: pollMultiple ? 100 : undefined,
      voted: false,
    };
  }

  // Add spoiler if selected
  if (spoiler) {
    base.sensitive = true;
    base.spoilerText = 'Content warning: test spoiler';

    if (spoilerType === 'mediaOnly') {
      // For media-only spoiler, remove spoilerText but keep sensitive true
      base.spoilerText = '';
    }
  }

  // Add mentions and tags if needed
  if (contentType === 'mentions') {
    base.mentions = [
      {
        id: '1',
        username: 'cheeaun',
        url: 'https://example.social/@cheeaun',
        acct: 'cheeaun',
      },
      {
        id: '2',
        username: 'test',
        url: 'https://example.social/@test',
        acct: 'test',
      },
      {
        id: '3',
        username: 'another_user',
        url: 'https://example.social/@another_user',
        acct: 'another_user',
      },
    ];
  }

  if (contentType === 'hashtags') {
    base.tags = [
      {
        name: 'coding',
        url: 'https://example.social/tags/coding',
      },
      {
        name: 'webdev',
        url: 'https://example.social/tags/webdev',
      },
      {
        name: 'javascript',
        url: 'https://example.social/tags/javascript',
      },
      {
        name: 'reactjs',
        url: 'https://example.social/tags/reactjs',
      },
      {
        name: 'preact',
        url: 'https://example.social/tags/preact',
      },
    ];
  }

  // Add any relevant filtered flags based on filter settings
  if (filters && filters.some((f) => f)) {
    base.filtered = filters
      .map((enabled, i) => {
        if (!enabled) return null;
        const filterTypes = ['hide', 'blur', 'warn'];
        return {
          filter: {
            id: `filter-${i}`,
            title: `Sample ${filterTypes[i]} filter`,
            context: ['home', 'public', 'thread', 'account'],
            filterAction: filterTypes[i],
          },
          keywordMatches: [],
          statusMatches: [],
        };
      })
      .filter(Boolean);
  }

  // Add link preview card if enabled
  if (showCard) {
    base.card = {
      url: 'https://example.com/article',
      title: 'Example Article Title',
      description:
        'This is a sample description for the link preview card that appears under content.',
      type: 'link',
      image: 'https://picsum.photos/seed/card/600/400',
      width: 600,
      height: 400,
      providerName: 'Example Website',
      providerUrl: 'https://example.com',
      authorName: 'John Doe',
      authorUrl: 'https://example.com/author',
      language: 'en',
      publishedAt: new Date().toISOString(),
      authors: [
        {
          account: {
            id: '1',
            username: 'test 2',
            name: 'Test 2',
            avatar: '/logo-192.png',
            acct: 'test2@localhost',
            url: 'https://test2.localhost',
          },
        },
      ],
    };
  }

  console.log('Final base', base);
  return base;
};

export default function Sandbox() {
  // Consolidated state for all toggles
  const [toggleState, setToggleState] = useState({
    loading: false,
    mediaFirst: false,
    hasContent: true,
    contentType: 'short',
    hasSpoiler: false,
    spoilerType: 'all',
    mediaCount: '0',
    mediaTypes: [],
    pollCount: '0',
    pollMultiple: false,
    pollExpired: false,
    showCard: false,
    size: 'medium',
    filters: [false, false, false], // hide, blur, warn
    mediaPreference: 'default',
    expandWarnings: false,
  });

  // Update function with view transitions
  const updateToggles = (updates) => {
    if (typeof updates === 'function') {
      updates = updates(toggleState);
    }

    // Check for browser support
    if (!document.startViewTransition) {
      setToggleState((prev) => ({ ...prev, ...updates }));
      return;
    }

    // Use view transition API
    document.startViewTransition(() => {
      setToggleState((prev) => ({ ...prev, ...updates }));
    });
  };

  // Set up preference stubbing
  useEffect(() => {
    console.log('User preference updated:', {
      mediaPreference: toggleState.mediaPreference,
      expandWarnings: toggleState.expandWarnings,
    });

    // Create a backup of the original method
    const originalGet = store.account.get;

    // Stub the store.account.get method to return our custom preferences
    store.account.get = (key) => {
      if (key === 'preferences') {
        console.log('Preferences requested, returning:', {
          'reading:expand:media': toggleState.mediaPreference,
          'reading:expand:spoilers': toggleState.expandWarnings,
        });
        return {
          'reading:expand:media': toggleState.mediaPreference,
          'reading:expand:spoilers': toggleState.expandWarnings,
        };
      }
      return originalGet.call(store.account, key);
    };

    // Clear the getPreferences cache to ensure our new preferences are used
    getPreferences.clear();

    // Restore the original method when the component unmounts
    return () => {
      store.account.get = originalGet;
      getPreferences.clear();
    };
  }, [toggleState.mediaPreference, toggleState.expandWarnings]);

  // Generate status with current toggle values
  const mockStatus = MOCK_STATUS({
    toggles: {
      loading: toggleState.loading,
      mediaFirst: toggleState.mediaFirst,
      contentFormat: toggleState.hasContent ? 'text' : null,
      contentType: toggleState.contentType,
      spoiler: toggleState.hasSpoiler,
      spoilerType: toggleState.spoilerType,
      mediaCount: toggleState.mediaCount,
      mediaTypes: toggleState.mediaTypes,
      pollCount: toggleState.pollCount,
      pollMultiple: toggleState.pollMultiple,
      pollExpired: toggleState.pollExpired,
      showCard: toggleState.showCard,
      size: toggleState.size,
      filters: toggleState.filters,
    },
  });

  // Handler for filter checkboxes
  const handleFilterChange = (index) => {
    const newFilters = [...toggleState.filters];
    newFilters[index] = !newFilters[index];
    updateToggles({ filters: newFilters });
  };

  return (
    <main id="sandbox">
      <header>
        <a href="#/" class="button plain4">
          ×
        </a>
        <h1>Sandbox</h1>
      </header>
      <div class="sandbox-preview">
        <FilterContext.Provider value={'home'}>
          {toggleState.loading ? (
            <Status
              skeleton
              mediaFirst={toggleState.mediaFirst}
              key={`skeleton-${toggleState.mediaFirst}`}
            />
          ) : (
            <Status
              status={mockStatus}
              mediaFirst={toggleState.mediaFirst}
              size={
                toggleState.size === 'small'
                  ? 's'
                  : toggleState.size === 'medium'
                    ? 'm'
                    : 'l'
              }
              allowFilters={true}
              // Add a key that changes when preferences change to force re-render
              key={`status-${toggleState.mediaPreference}-${toggleState.expandWarnings}-${mockStatus.id}`}
              // Prevent opening as URL
              onMediaClick={(e, i, media, status) => {
                e.preventDefault();
                states.showMediaModal = {
                  mediaAttachments: status.mediaAttachments,
                  mediaIndex: i,
                };
              }}
            />
          )}
        </FilterContext.Provider>
      </div>
      <form class="sandbox-toggles" onSubmit={(e) => e.preventDefault()}>
        <h2>Toggles</h2>
        <ul>
          <li>
            <b>Miscellaneous</b>
            <ul>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.loading}
                    onChange={() =>
                      updateToggles({ loading: !toggleState.loading })
                    }
                  />
                  <span>Loading</span>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.mediaFirst}
                    onChange={() =>
                      updateToggles({ mediaFirst: !toggleState.mediaFirst })
                    }
                  />
                  <span>Media first</span>
                </label>
              </li>
            </ul>
          </li>
          <li>
            <b>Content</b>
            <ul>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.hasContent}
                    onChange={() => {
                      // Create the update object
                      const updates = { hasContent: !toggleState.hasContent };

                      // If turning off text and no media, then add media
                      if (
                        toggleState.hasContent &&
                        parseInt(toggleState.mediaCount) === 0
                      ) {
                        updates.mediaCount = '1';
                      }

                      // Apply all updates in one transition
                      updateToggles(updates);
                    }}
                    disabled={parseInt(toggleState.mediaCount) === 0}
                  />
                  <span>Text</span>
                </label>
                <ul>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="contentType"
                        checked={toggleState.contentType === 'short'}
                        onChange={() => updateToggles({ contentType: 'short' })}
                        disabled={!toggleState.hasContent}
                      />
                      <span>Short</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="contentType"
                        checked={toggleState.contentType === 'long'}
                        onChange={() => updateToggles({ contentType: 'long' })}
                        disabled={!toggleState.hasContent}
                      />
                      <span>Long</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="contentType"
                        checked={toggleState.contentType === 'links'}
                        onChange={() => updateToggles({ contentType: 'links' })}
                        disabled={!toggleState.hasContent}
                      />
                      <span>With links</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="contentType"
                        checked={toggleState.contentType === 'hashtags'}
                        onChange={() =>
                          updateToggles({ contentType: 'hashtags' })
                        }
                        disabled={!toggleState.hasContent}
                      />
                      <span>With hashtags</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="contentType"
                        checked={toggleState.contentType === 'mentions'}
                        onChange={() =>
                          updateToggles({ contentType: 'mentions' })
                        }
                        disabled={!toggleState.hasContent}
                      />
                      <span>With mentions</span>
                    </label>
                  </li>
                </ul>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.hasSpoiler}
                    onChange={() =>
                      updateToggles({ hasSpoiler: !toggleState.hasSpoiler })
                    }
                  />
                  <span>Content warning</span>
                </label>
                <ul>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="spoilerType"
                        checked={toggleState.spoilerType === 'all'}
                        onChange={() => updateToggles({ spoilerType: 'all' })}
                      />
                      <span>Whole content</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="spoilerType"
                        checked={toggleState.spoilerType === 'mediaOnly'}
                        onChange={() =>
                          updateToggles({ spoilerType: 'mediaOnly' })
                        }
                      />
                      <span>Media only</span>
                    </label>
                  </li>
                </ul>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={parseInt(toggleState.mediaCount) > 0}
                    onChange={(e) => {
                      const newHasMedia = e.target.checked;
                      const updates = {
                        mediaCount: newHasMedia ? '1' : '0',
                        mediaTypes: newHasMedia ? ['image'] : [],
                      };

                      // If removing media and no text content, enable text content
                      if (!newHasMedia && !toggleState.hasContent) {
                        updates.hasContent = true;
                      }

                      updateToggles(updates);
                    }}
                  />
                  <span>Media</span>
                  <input
                    type="number"
                    min="1"
                    // max="4"
                    value={
                      toggleState.mediaCount === '0'
                        ? '1'
                        : toggleState.mediaCount
                    }
                    step="1"
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      updateToggles(({ mediaTypes = [] }) => {
                        mediaTypes[value - 1] = 'image';
                        return {
                          mediaCount: String(value),
                          mediaTypes,
                        };
                      });
                    }}
                    disabled={parseInt(toggleState.mediaCount) === 0}
                  />
                </label>

                {parseInt(toggleState.mediaCount) > 0 && (
                  <ul class="media-types">
                    {Array.from(
                      { length: parseInt(toggleState.mediaCount) },
                      (_, index) => (
                        <li key={`media-type-${index}`}>
                          <label>
                            <input
                              type="radio"
                              name={`mediaType${index}`}
                              checked={
                                toggleState.mediaTypes[index] === 'image'
                              }
                              onChange={() => {
                                const newMediaTypes = [
                                  ...toggleState.mediaTypes,
                                ];
                                newMediaTypes[index] = 'image';
                                updateToggles({ mediaTypes: newMediaTypes });
                              }}
                            />
                            <span>Image</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`mediaType${index}`}
                              checked={toggleState.mediaTypes[index] === 'gifv'}
                              onChange={() => {
                                const newMediaTypes = [
                                  ...toggleState.mediaTypes,
                                ];
                                newMediaTypes[index] = 'gifv';
                                updateToggles({ mediaTypes: newMediaTypes });
                              }}
                            />
                            <span>GIFV</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`mediaType${index}`}
                              checked={
                                toggleState.mediaTypes[index] === 'video'
                              }
                              onChange={() => {
                                const newMediaTypes = [
                                  ...toggleState.mediaTypes,
                                ];
                                newMediaTypes[index] = 'video';
                                updateToggles({ mediaTypes: newMediaTypes });
                              }}
                            />
                            <span>Video</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`mediaType${index}`}
                              checked={
                                toggleState.mediaTypes[index] === 'audio'
                              }
                              onChange={() => {
                                const newMediaTypes = [
                                  ...toggleState.mediaTypes,
                                ];
                                newMediaTypes[index] = 'audio';
                                updateToggles({ mediaTypes: newMediaTypes });
                              }}
                            />
                            <span>Audio</span>
                          </label>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={parseInt(toggleState.pollCount) > 0}
                    onChange={(e) => {
                      const updates = {
                        pollCount: e.target.checked ? '2' : '0',
                      };

                      // Reset multiple to false when disabling poll
                      if (!e.target.checked) {
                        updates.pollMultiple = false;
                      }

                      updateToggles(updates);
                    }}
                  />
                  <span>Poll</span>
                  <input
                    type="number"
                    min="2"
                    value={toggleState.pollCount}
                    step="1"
                    onChange={(e) =>
                      updateToggles({ pollCount: e.target.value })
                    }
                    disabled={parseInt(toggleState.pollCount) === 0}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={toggleState.pollMultiple}
                      onChange={() =>
                        updateToggles({
                          pollMultiple: !toggleState.pollMultiple,
                        })
                      }
                      disabled={parseInt(toggleState.pollCount) === 0}
                    />
                    <span>Multiple</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={toggleState.pollExpired}
                      onChange={() =>
                        updateToggles({ pollExpired: !toggleState.pollExpired })
                      }
                      disabled={parseInt(toggleState.pollCount) === 0}
                    />
                    <span>Expired</span>
                  </label>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.showCard}
                    onChange={() =>
                      updateToggles({ showCard: !toggleState.showCard })
                    }
                  />
                  <span>Link preview card</span>
                </label>
              </li>
            </ul>
          </li>
          <li>
            <b>Size</b>
            <ul>
              <li>
                <label>
                  <input
                    type="radio"
                    name="size"
                    checked={toggleState.size === 'small'}
                    onChange={() => updateToggles({ size: 'small' })}
                  />
                  <span>Small</span>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="radio"
                    name="size"
                    checked={toggleState.size === 'medium'}
                    onChange={() => updateToggles({ size: 'medium' })}
                  />
                  <span>Medium</span>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="radio"
                    name="size"
                    checked={toggleState.size === 'large'}
                    onChange={() => updateToggles({ size: 'large' })}
                  />
                  <span>Large</span>
                </label>
              </li>
            </ul>
          </li>
          <li>
            <b>Filters</b>
            <ul>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.filters[0]}
                    onChange={() => handleFilterChange(0)}
                  />
                  <span>Hide</span>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.filters[1]}
                    onChange={() => handleFilterChange(1)}
                  />
                  <span>Blur</span>
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.filters[2]}
                    onChange={() => handleFilterChange(2)}
                  />
                  <span>Warn</span>
                </label>
              </li>
            </ul>
          </li>
          <li>
            <h3>User preferences for sensitive content</h3>
            <ul>
              <li>
                <b>Media display</b>
                <ul>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="mediaPreference"
                        checked={toggleState.mediaPreference === 'default'}
                        onChange={() =>
                          updateToggles({ mediaPreference: 'default' })
                        }
                      />
                      <span>Hide media marked as sensitive</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="mediaPreference"
                        checked={toggleState.mediaPreference === 'show_all'}
                        onChange={() =>
                          updateToggles({ mediaPreference: 'show_all' })
                        }
                      />
                      <span>Always show media</span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="mediaPreference"
                        checked={toggleState.mediaPreference === 'hide_all'}
                        onChange={() =>
                          updateToggles({ mediaPreference: 'hide_all' })
                        }
                      />
                      <span>Always hide media</span>
                    </label>
                  </li>
                </ul>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={toggleState.expandWarnings}
                    onChange={() =>
                      updateToggles({
                        expandWarnings: !toggleState.expandWarnings,
                      })
                    }
                  />{' '}
                  <span>Always expand posts marked with content warnings</span>
                </label>
              </li>
            </ul>
          </li>
        </ul>
      </form>
    </main>
  );
}
