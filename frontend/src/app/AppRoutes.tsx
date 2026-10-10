import { Navigate, Route, Routes } from 'react-router';
import { ActivityRoute } from '../features/activity/components/ActivityRoute';
import { ReportFeedbackRoute } from '../features/activity/components/ReportFeedbackRoute';
import { AreaLetterRoute } from '../features/letters/components/AreaLetterRoute';
import { AreaRoute } from '../features/areas/components/AreaRoute';
import { AreasRoute } from '../features/areas/components/AreasRoute';
import { AccountRoute } from '../features/auth/components/AccountRoute';
import { CleanupRoute } from '../features/cleanup/components/CleanupRoute';
import { LetterRoute } from '../features/letters/components/LetterRoute';
import { MapPage } from '../features/map/components/MapPage';
import { RankingRoute } from '../features/ranking/components/RankingRoute';
import { OnboardingRoute } from '../features/onboarding/components/OnboardingRoute';
import { PanelHome } from '../features/map/components/PanelHome';
import { SitePanelRoute } from '../features/site/components/SitePanelRoute';
import { SnapRoute } from '../features/snap/components/SnapRoute';
import {
  ACCOUNT_PATH,
  ACTIVITY_PATH,
  AREA_LETTER_PATH,
  AREA_PATH,
  AREAS_PATH,
  FEEDBACK_PATH,
  RANKING_PATH,
  SITE_CLEANUP_PATH,
  SITE_LETTER_PATH,
  SITE_PATH,
  SNAP_PATH,
  WELCOME_PATH,
} from './paths';

// The map stays mounted; every other screen is a sheet over it.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />}>
        <Route index element={<PanelHome />} />
        <Route path={SITE_PATH} element={<SitePanelRoute />} />
        <Route path={SITE_CLEANUP_PATH} element={<CleanupRoute />} />
        <Route path={SITE_LETTER_PATH} element={<LetterRoute />} />
        <Route path={SNAP_PATH} element={<SnapRoute />} />
        <Route path={AREAS_PATH} element={<AreasRoute />} />
        <Route path={AREA_PATH} element={<AreaRoute />} />
        <Route path={AREA_LETTER_PATH} element={<AreaLetterRoute />} />
        <Route path={RANKING_PATH} element={<RankingRoute />} />
        <Route path={ACTIVITY_PATH} element={<ActivityRoute />} />
        <Route path={FEEDBACK_PATH} element={<ReportFeedbackRoute />} />
        <Route path={ACCOUNT_PATH} element={<AccountRoute />} />
        <Route path={WELCOME_PATH} element={<OnboardingRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
