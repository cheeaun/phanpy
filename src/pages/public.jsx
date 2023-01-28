// EXPERIMENTAL: This is a work in progress and may not work as expected.
import { useMatch, useParams } from 'react-router-dom';

import Timeline from '../components/timeline';

const LIMIT = 20;

let nextUrl = null;

function Public() {
  const isLocal = !!useMatch('/p/l/:instance');
  const params = useParams();
  const { instance = '' } = params;
  async function fetchPublic(firstLoad) {
    const url = firstLoad
      ? `https://${instance}/api/v1/timelines/public?limit=${LIMIT}&local=${isLocal}`
      : nextUrl;
    if (!url) return { values: [], done: true };
    const response = await fetch(url);
    let value = await response.json();
    if (value) {
      value = camelCaseKeys(value);
    }
    const done = !response.headers.has('link');
    nextUrl = done
      ? null
      : response.headers.get('link').match(/<(.+?)>; rel="next"/)?.[1];
    console.debug({
      url,
      value,
      done,
      nextUrl,
    });
    return { value, done };
  }

  return (
    <Timeline
      key={instance + isLocal}
      title={`${instance} (${isLocal ? 'local' : 'federated'})`}
      id="public"
      emptyText="No one has posted anything yet."
      errorText="Unable to load posts"
      fetchItems={fetchPublic}
    />
  );
}

function camelCaseKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => camelCaseKeys(item));
  }
  return new Proxy(obj, {
    get(target, prop) {
      let value = undefined;
      if (prop in target) {
        value = target[prop];
      }
      if (!value) {
        const snakeCaseProp = prop.replace(
          /([A-Z])/g,
          (g) => `_${g.toLowerCase()}`,
        );
        if (snakeCaseProp in target) {
          value = target[snakeCaseProp];
        }
      }
      if (value && typeof value === 'object') {
        return camelCaseKeys(value);
      }
      return value;
    },
  });
}

export default Public;
