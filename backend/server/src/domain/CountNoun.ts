// A count with its noun in the right number: "1 person" and "3 people", or Hindi "1 व्यक्ति" and "3 लोगों".
export class CountNoun {
  readonly #one: string;
  readonly #many: string;

  constructor(one: string, many: string) {
    this.#one = one;
    this.#many = many;
  }

  of(count: number): string {
    return `${count} ${count === 1 ? this.#one : this.#many}`;
  }
}
