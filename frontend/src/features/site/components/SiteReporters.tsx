import { useConfig } from '../../../app/useConfig';
import type { SiteProperties } from '../../../domain/Site';
import { SiteEvidenceView } from '../SiteEvidenceView';
import { SiteEvidenceSection } from './SiteEvidenceSection';

/** How many people reported the site and, under its own heading, how far the nearest known bin is (dumps and no-bin zones). */
export function SiteReporters({ site }: { readonly site: SiteProperties }) {
  const { zoneRadiusM } = useConfig().site;
  return (
    <>
      <SiteEvidenceSection title="site.evidence" lines={SiteEvidenceView.reporters(site)} />
      <SiteEvidenceSection title="site.binTitle" lines={SiteEvidenceView.bin(site, zoneRadiusM)} />
    </>
  );
}
