import type { SiteLocation } from '../../domain/Site';
import type { Fact } from '../../ui/FactList';

export type Translate = (key: string, params?: Readonly<Record<string, string>>) => string;

/** How a site's location reads on screen; area names are data and stay untranslated. */
export class LocationPresenter {
  readonly #location: SiteLocation;
  readonly #t: Translate;

  constructor(location: SiteLocation, translate: Translate) {
    this.#location = location;
    this.#t = translate;
  }

  /** Ward, MLA seat and MP seat on one line; an outdated MP seat is left out. */
  line(): string {
    const { ward, assembly_seat: assembly, loksabha_seat: loksabha } = this.#location;
    const parts = [
      ward?.name ?? this.#t('site.noWard'),
      assembly ? this.#t('site.mla', { name: assembly.name }) : this.#t('site.noAssembly'),
    ];
    if (loksabha.status !== 'outdated') parts.push(this.#t('site.mp', { name: loksabha.name }));
    return parts.join(' · ');
  }

  facts(): readonly Fact[] {
    const { local_body: body, ward, assembly_seat: assembly, loksabha_seat: loksabha } = this.#location;
    return [
      { label: this.#t('site.localBody'), value: body?.name ?? this.#t('site.notKnown') },
      { label: this.#t('site.ward'), value: ward?.name ?? this.#t('site.noWard') },
      { label: this.#t('site.assemblySeat'), value: assembly?.name ?? this.#t('site.noAssembly') },
      {
        label: this.#t('site.loksabhaSeat'),
        value: loksabha.status === 'outdated' ? this.#t('site.seatOutdated') : loksabha.name,
      },
    ];
  }
}
