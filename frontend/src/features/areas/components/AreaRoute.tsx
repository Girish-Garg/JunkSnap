import { Navigate, useParams } from 'react-router';
import { AREAS_PATH } from '../../../app/paths';
import { AreaKey } from '../../../domain/AreaKey';
import { AreaSheet } from './AreaSheet';

/** /areas/:kind/:areaId; an unknown kind goes back to the area list. */
export function AreaRoute() {
  const { kind = '', areaId = '' } = useParams();
  if (!AreaKey.isKind(kind)) return <Navigate to={AREAS_PATH} replace />;
  return <AreaSheet kind={kind} areaId={areaId} />;
}
