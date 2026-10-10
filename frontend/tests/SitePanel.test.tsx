import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { factValue, fixtureSite, renderApp } from './helpers';
import { testSite } from './siteBuilder';

const english = new LocaleFormatter('en');
const BRAND = { brand: 'Sample Namkeen', parent_company: 'Sample Foods Pvt Ltd', confidence: 0.93, source_url: 'https://example.test/brand' };

describe('SitePanel header and counts', () => {
  it('shows type, status, verification, context and counts', async () => {
    await renderApp(<SitePanel site={testSite({ cleanup_status: 'checking' })} userLocation={null} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.getByText('Open')).toHaveClass('badge--open');
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Vacant plot · Jodhpur, Rajasthan')).toBeInTheDocument();
    expect(screen.getByText('Pilot city')).toBeInTheDocument();
    expect(screen.getByText('Cleanup photo being checked')).toBeInTheDocument();
    expect(factValue('Reports')).toHaveTextContent('7');
    expect(factValue('Verified reports')).toHaveTextContent('6');
  });

  it('shows the distance once the user location is known', async () => {
    await renderApp(<SitePanel site={testSite()} userLocation={[73.0035, 26.2708]} />);
    expect(screen.getByText(/^1 km away$/)).toBeInTheDocument();
  });
});

describe('SitePanel photos, location and brands', () => {
  it('shows the blurred photo, location line and facts', async () => {
    const site = testSite({ brands: [BRAND] });
    await renderApp(<SitePanel site={site} userLocation={null} />);
    expect(screen.getByRole('img', { name: 'Blurred photo 1 of 1' })).toHaveAttribute('src', site.properties.photo_urls[0]);
    expect(screen.getByText('Ward 37 · MLA seat: Sardarpura · MP seat: Jodhpur')).toBeInTheDocument();
    expect(factValue('Local body')).toHaveTextContent('Test Municipal Corporation');
    expect(factValue('Assembly seat (MLA)')).toHaveTextContent('Sardarpura');
    expect(factValue('Lok Sabha seat (MP)')).toHaveTextContent('Jodhpur');
    expect(screen.getByRole('link', { name: 'Sample Foods Pvt Ltd' })).toHaveAttribute('href', BRAND.source_url);
  });

  it('handles a site outside Rajasthan with no assembly map and an outdated MP seat', async () => {
    const location = { ward: null, assembly_seat: null, loksabha_seat: { id: 's03-pc-4', name: 'Guwahati', status: 'outdated' as const } };
    await renderApp(<SitePanel site={testSite({ location })} userLocation={null} />);
    expect(screen.getByText('Ward: not mapped yet; letters go to the city-wide body · No assembly map here yet')).toBeInTheDocument();
    expect(factValue('Assembly seat (MLA)')).toHaveTextContent('No assembly map here yet');
    expect(factValue('Lok Sabha seat (MP)')).toHaveTextContent('Boundary out of date');
  });

  it('makes Letter the main action of a verified site, with no "coming soon" stub', async () => {
    await renderApp(<SitePanel site={testSite()} userLocation={null} />);
    expect(screen.getByRole('button', { name: 'Letter' })).toHaveClass('action-row__button--primary');
    expect(screen.getByRole('button', { name: 'Letter' })).toBeEnabled();
    expect(screen.queryByText(/coming soon/)).not.toBeInTheDocument();
  });
});

describe('SitePanel for the fixtures and Hindi', () => {
  it('makes Confirm the main action and shows the backers while unverified', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jpr_1')} userLocation={null} />);
    expect(factValue('Ward')).toHaveTextContent('Not mapped yet; letters go to the city-wide body');
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('action-row__button--primary');
    expect(screen.queryByText('Packaging seen at this site')).not.toBeInTheDocument();
  });

  it('shows the dates, the cleanup photo and the reopened status', async () => {
    const site = await fixtureSite('site_jdh_3');
    await renderApp(<SitePanel site={site} userLocation={null} />);
    expect(screen.getByText('Reopened')).toHaveClass('badge--reopened');
    expect(screen.getByRole('img', { name: 'Blurred photo after the last cleanup' })).toBeInTheDocument();
    expect(factValue('First reported')).toHaveTextContent(english.dateTime(site.properties.first_reported_at));
    expect(factValue('Last cleared')).toHaveTextContent(english.dateTime(site.properties.cleaned_at ?? ''));
  });

  it('renders labels and dates in Hindi', async () => {
    const site = testSite();
    await renderApp(<SitePanel site={site} userLocation={null} />, { language: 'hi' });
    expect(screen.getByRole('heading', { level: 2, name: 'कचरे का ढेर' })).toBeInTheDocument();
    expect(factValue('वार्ड')).toHaveTextContent('Ward 37');
    const firstReported = new LocaleFormatter('hi').dateTime(site.properties.first_reported_at);
    expect(factValue('पहली रिपोर्ट')).toHaveTextContent(firstReported);
  });
});

describe('SitePanel backers', () => {
  it('shows n of 10 people confirmed and the vote for an unverified site', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jpr_1')} userLocation={null} />);
    expect(screen.getByText('2 of 10 people confirmed')).toBeInTheDocument();
    expect(screen.getByText('1 by photo, 1 by vote')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    expect(screen.getByRole('button', { name: "Yes, it's waste" })).toBeInTheDocument();
  });
});
