import { useParams } from 'react-router-dom';

import Status from './status';

export default function StatusRoute() {
  const params = useParams();
  const { id, instance } = params;
  return <Status id={id} instance={instance} />;
}
