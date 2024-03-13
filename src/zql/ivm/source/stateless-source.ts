import {MaterialiteForSourceInternal} from '../materialite.js';
import {Entry, Multiset} from '../multiset.js';
import {DifferenceStream} from '../graph/difference-stream.js';
import {SourceInternal} from './source.js';
import {Version} from '../types.js';

/**
 * Is a source of values.
 */
export class StatelessSource<T> {
  #stream: DifferenceStream<T>;
  readonly #internal: SourceInternal;
  readonly #materialite: MaterialiteForSourceInternal;

  #pending: Entry<T>[] = [];

  constructor(materialite: MaterialiteForSourceInternal) {
    this.#materialite = materialite;
    this.#stream = new DifferenceStream<T>();
    this.#internal = {
      // add values to queues, add values to the set
      onCommitEnqueue: (version: Version) => {
        this.#stream.queueData([version, new Multiset(this.#pending)]);
        this.#pending = [];
      },
      // release queues by telling the stream to send data
      onCommitRun: (version: Version) => {
        this.#stream.notify(version);
      },
      // notify effects / listeners
      // this is done once the entire reactive graph has finished computing
      // itself
      onCommitted: (v: Version) => {
        this.#stream.notifyCommitted(v);
      },
      onRollback: () => {
        this.#pending = [];
      },
    };
  }

  get stream(): DifferenceStream<T> {
    return this.#stream;
  }

  addAll(values: Iterable<T>): this {
    // TODO (mlaw): start a materialite transaction
    for (const v of values) {
      this.#pending.push([v, 1]);
    }
    this.#materialite.addDirtySource(this.#internal);
    return this;
  }

  add(value: T): this {
    this.#pending.push([value, 1]);
    this.#materialite.addDirtySource(this.#internal);
    return this;
  }

  delete(value: T): this {
    this.#pending.push([value, -1]);
    this.#materialite.addDirtySource(this.#internal);
    return this;
  }

  deleteAll(values: Iterable<T>): this {
    for (const v of values) {
      this.#pending.push([v, -1]);
    }
    this.#materialite.addDirtySource(this.#internal);
    return this;
  }
}