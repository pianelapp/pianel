export type EngineVolumeSkipReason = 'unsupported' | 'not-connected' | 'unchanged';

export type EngineVolumeDelivery =
  | {status: 'delivered'; value: number}
  | {status: 'failed'; value: number}
  | {status: 'skipped'; reason: EngineVolumeSkipReason};
