// Dedicated module Worker: tries every label it is sent with `new TextDecoder(label)`.
import { probeLabels } from '../helpers/encoding-labels';

onmessage = (event: MessageEvent<string[]>) => {
  postMessage(probeLabels(event.data));
};
