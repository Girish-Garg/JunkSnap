import { Box } from "./Box.js";
import { IndianPlatePattern } from "./IndianPlatePattern.js";

export interface TextWord {
  readonly text: string;
  readonly box: Box;
}

// One OCR line with its words in reading order.
export interface TextLine extends TextWord {
  readonly words: readonly TextWord[];
}

const MAX_RUN = 4;

// Finds number plates in OCR text: whole lines, runs of words inside a line, and two-line plates.
export class PlateTextScanner {
  readonly #pattern = new IndianPlatePattern();

  plateBoxes(lines: readonly TextLine[]): Box[] {
    return Box.distinct([...lines.flatMap((line) => this.#inLine(line)), ...this.#acrossLines(lines)]);
  }

  #inLine(line: TextLine): Box[] {
    if (this.#pattern.isPlate(line.text)) {
      return [line.box];
    }
    return this.#wordRuns(line.words)
      .filter((run) => this.#pattern.isPlate(run.text))
      .map((run) => run.box);
  }

  #wordRuns(words: readonly TextWord[]): TextWord[] {
    return words.flatMap((_word, start) =>
      Array.from({ length: Math.min(MAX_RUN, words.length - start) }, (_unused, index) => {
        const run = words.slice(start, start + index + 1);
        return { text: run.map((word) => word.text).join(""), box: Box.enclosing(run.map((word) => word.box)) };
      }),
    );
  }

  // OCR may list the two lines of a bike or auto plate apart, so pair them by position.
  #acrossLines(lines: readonly TextLine[]): Box[] {
    const tops = lines.filter((line) => this.#pattern.isTopLine(line.text));
    const bottoms = lines.filter((line) => this.#pattern.isBottomLine(line.text));
    return tops.flatMap((top) =>
      bottoms.filter((bottom) => bottom.box.liesJustBelow(top.box)).map((bottom) => Box.enclosing([top.box, bottom.box])),
    );
  }
}
