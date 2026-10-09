export interface SentCommand {
  readonly name: string;
  readonly input: Record<string, unknown>;
}

type Answer = (command: SentCommand) => unknown;

// Stands in for an AWS SDK client: records each command and answers from a script, then from a fallback.
export class ScriptedClient {
  readonly sent: SentCommand[] = [];
  readonly #answers: Answer[];
  readonly #fallback: Answer;

  constructor(answers: Answer[] = [], fallback: Answer = () => ({})) {
    this.#answers = answers;
    this.#fallback = fallback;
  }

  async send(command: { input: Record<string, unknown> }): Promise<unknown> {
    const sent = { name: command.constructor.name, input: command.input };
    this.sent.push(sent);
    const answer = this.#answers.shift() ?? this.#fallback;
    return answer(sent);
  }

  as<T>(): T {
    return this as unknown as T;
  }
}

export function failure(name: string): () => never {
  return () => {
    throw Object.assign(new Error(`${name} from the fake`), { name });
  };
}

export const conditionFailed = failure("ConditionalCheckFailedException");
