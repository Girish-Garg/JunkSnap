import type { SignalEvidence } from './ReportEvidence';

const PROVIDERS: Readonly<Record<string, string>> = {
  bedrock: 'Amazon Bedrock',
  rekognition: 'Amazon Rekognition',
  comprehend: 'Amazon Comprehend',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  junksnap: 'JunkSnap',
};

// Model ids as the evidence records them (for example apac.amazon.nova-lite-v1:0) to a short name.
const MODELS: readonly (readonly [RegExp, string])[] = [
  [/nova-2-lite/, 'Nova 2 Lite'],
  [/nova-lite/, 'Nova Lite'],
  [/nova-pro/, 'Nova Pro'],
  [/nova-micro/, 'Nova Micro'],
  [/claude-sonnet/, 'Claude Sonnet'],
  [/claude-haiku/, 'Claude Haiku'],
  [/claude-opus/, 'Claude Opus'],
];

/** A model named as the evidence records it: a short display name, the provider, and the exact id and version. */
export class ModelLabel {
  readonly model: string;
  readonly provider: string;
  /** The exact model id and version from the evidence, for the small print. */
  readonly exact: string;

  constructor(signal: Pick<SignalEvidence, 'provider' | 'model' | 'version'>) {
    this.model = MODELS.find(([pattern]) => pattern.test(signal.model))?.[1] ?? signal.model;
    this.provider = PROVIDERS[signal.provider] ?? signal.provider;
    this.exact = `${signal.model} · ${signal.version}`;
  }
}
