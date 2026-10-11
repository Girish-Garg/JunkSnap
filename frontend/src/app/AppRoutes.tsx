import type { ReactElement } from 'react';
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
import { PlacesRoute } from '../features/places/components/PlacesRoute';
import { SitePanelRoute } from '../features/site/components/SitePanelRoute';
import { SnapRoute } from '../features/snap/components/SnapRoute';
import {
  ACCOUNT_PATH,
  ACTIVITY_PATH,
  AREA_LETTER_PATH,
  AREA_PATH,
  AREAS_PATH,
  FEEDBACK_PATH,
  PLACES_PATH,
  RANKING_PATH,
  SITE_CLEANUP_PATH,
  SITE_LETTER_PATH,
  SITE_PATH,
  SNAP_PATH,
  WELCOME_PATH,
} from './paths';
import { SheetBoundary } from './SheetBoundary';

// A crash inside one sheet stays in that sheet.
const sheet = (element: ReactElement) => <SheetBoundary>{element}</SheetBoundary>;

// The map stays mounted; every other screen is a sheet over it.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />}>
        <Route index element={<PanelHome />} />
        <Route path={SITE_PATH} element={sheet(<SitePanelRoute />)} />
        <Route path={SITE_CLEANUP_PATH} element={sheet(<CleanupRoute />)} />
        <Route path={SITE_LETTER_PATH} element={sheet(<LetterRoute />)} />
        <Route path={SNAP_PATH} element={sheet(<SnapRoute />)} />
        <Route path={AREAS_PATH} element={sheet(<AreasRoute />)} />
        <Route path={AREA_PATH} element={sheet(<AreaRoute />)} />
        <Route path={AREA_LETTER_PATH} element={sheet(<AreaLetterRoute />)} />
        <Route path={RANKING_PATH} element={sheet(<RankingRoute />)} />
        <Route path={PLACES_PATH} element={sheet(<PlacesRoute />)} />
        <Route path={ACTIVITY_PATH} element={sheet(<ActivityRoute />)} />
        <Route path={FEEDBACK_PATH} element={sheet(<ReportFeedbackRoute />)} />
        <Route path={ACCOUNT_PATH} element={sheet(<AccountRoute />)} />
        <Route path={WELCOME_PATH} element={sheet(<OnboardingRoute />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
