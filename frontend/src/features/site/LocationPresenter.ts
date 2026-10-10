import { areaPath } from '../../app/paths';
import type { AreaKind } from '../../domain/AreaScores';
import type { AreaRef, SiteLocation } from '../../domain/Site';
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
      ward?.name ?? this.#t('site.noWardLine'),
      assembly ? this.#t('site.mla', { name: assembly.name }) : this.#t('site.noAssembly'),
    ];
    if (loksabha.status !== 'outdated') parts.push(this.#t('site.mp', { name: loksabha.name }));
    return parts.join(' · ');
  }

  /** Each known area links to its area page; an outdated MP seat does not. */
  facts(): readonly Fact[] {
    const { local_body: body, district, ward, assembly_seat: assembly, loksabha_seat: loksabha } = this.#location;
    const current = loksabha.status === 'outdated' ? null : loksabha;
    return [
      { label: this.#t('site.localBody'), value: body?.name ?? this.#t('site.notKnown') },
      this.#areaFact('site.district', 'district', district, 'site.notKnown'),
      this.#areaFact('site.ward', 'ward', ward, 'site.noWard'),
      this.#areaFact('site.assemblySeat', 'assembly', assembly, 'site.noAssembly'),
      this.#areaFact('site.loksabhaSeat', 'loksabha', current, 'site.seatOutdated'),
    ];
  }

  #areaFact(label: string, kind: AreaKind, ref: AreaRef | null, missingKey: string): Fact {
    const fact = { label: this.#t(label), value: ref?.name ?? this.#t(missingKey) };
    return ref ? { ...fact, to: areaPath(kind, ref.id) } : fact;
  }
}
