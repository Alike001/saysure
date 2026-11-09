import { ensure } from './core.mjs';
import { sandboxAdapterProvenance } from './paypal-sandbox.mjs';
// Read-only classification. This module has no registration or provenance-minting API.
export function adapterProvenance(client) {
  const sealed = sandboxAdapterProvenance(client);
  if (sealed) return sealed;
  // Unregistered injected clients may supply fixtures only, never genuine API evidence.
  ensure(client?.provenance === 'mock-paypal-fixture', 'ORDER_PROVENANCE_INVALID');
  return 'mock-paypal-fixture';
}
