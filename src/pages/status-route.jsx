import { useParams } from 'react-router-dom';

import { encodeAtprotoID } from '../utils/atproto-route';

import Status from './status';

export default function StatusRoute() {
  const params = useParams();
  let { id, instance } = params;
  if (id?.startsWith('at://')) id = encodeAtprotoID(id);
  return <Status id={id} instance={instance} />;
}
