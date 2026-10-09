import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { factValue, fixtureSite, renderApp } from './helpers';

const english = new LocaleFormatter('en');

describe('SitePanel header and counts', () => {
  it('shows type, status, verification, context and counts', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_1')} userLocation={null} />);
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
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_1')} userLocation={[73.0035, 26.2708]} />);
    expect(screen.getByText(/^1 km away$/)).toBeInTheDocument();
  });
});

describe('SitePanel photos, location and brands', () => {
  it('shows the blurred photos, location line and facts', async () => {
    const site = await fixtureSite('site_jdh_1');
    await renderApp(<SitePanel site={site} userLocation={null} />);
    const photo = screen.getByRole('img', { name: 'Blurred photo 1 of 2' });
    expect(photo).toHaveAttribute('src', site.properties.photo_urls[0]);
    expect(screen.getByText('Ward 37 · MLA seat: Sardarpura · MP seat: Jodhpur')).toBeInTheDocument();
    expect(factValue('Local body')).toHaveTextContent('Jodhpur Municipal Corporation (South)');
    expect(factValue('Assembly seat (MLA)')).toHaveTextContent('Sardarpura');
    expect(factValue('Lok Sabha seat (MP)')).toHaveTextContent('Jodhpur');
    const parent = screen.getByRole('link', { name: 'Sample Foods Pvt Ltd' });
    expect(parent).toHaveAttribute('href', site.properties.brands[0]?.source_url);
  });

  it('says in visible text which actions are not built yet', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_1')} userLocation={null} />);
    expect(screen.getByText('Coming soon: Confirm, Me too, Cleaned and Letter.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Letter' })).toHaveClass('action-row__button--primary');
  });
});

describe('SitePanel for other fixtures and Hindi', () => {
  it('says when there is no ward map and makes Confirm the main action', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jpr_1')} userLocation={null} />);
    expect(factValue('Ward')).toHaveTextContent('No open ward map');
    expect(screen.getByText('Waiting for a neighbour check')).toBeInTheDocument();
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
    const site = await fixtureSite('site_jdh_1');
    await renderApp(<SitePanel site={site} userLocation={null} />, { language: 'hi' });
    expect(screen.getByRole('heading', { level: 2, name: 'कचरे का ढेर' })).toBeInTheDocument();
    expect(factValue('वार्ड')).toHaveTextContent('Ward 37');
    const firstReported = new LocaleFormatter('hi').dateTime(site.properties.first_reported_at);
    expect(factValue('पहली रिपोर्ट')).toHaveTextContent(firstReported);
  });
});
