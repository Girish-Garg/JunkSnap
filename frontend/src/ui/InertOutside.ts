/** Marks every element outside `inside` inert (sibling by sibling up to <body>); returns the undo. */
export class InertOutside {
  static mark(inside: HTMLElement): () => void {
    const marked: HTMLElement[] = [];
    for (let node: HTMLElement | null = inside; node && node !== document.body; node = node.parentElement) {
      marked.push(...InertOutside.#siblings(node));
    }
    for (const element of marked) element.inert = true;
    return () => marked.forEach((element) => (element.inert = false));
  }

  static #siblings(node: HTMLElement): HTMLElement[] {
    const all = Array.from(node.parentElement?.children ?? []);
    return all.filter((sibling): sibling is HTMLElement => sibling !== node && sibling instanceof HTMLElement && !sibling.inert);
  }
}
