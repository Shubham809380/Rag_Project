import sovereign from '../config/sovereign.js';
import LocalModelProvider from './local.js';
import CloudProvider from './cloud.js';

// Resolution rule (enforced by the router AND here):
//   sovereign/local  → NEVER cloud. Only the local gateway may be used.
//   online           → cloud provider allowed (build/staging fleet).
let _local = null;
let _cloud = null;

export function getLocalProvider() {
  if (!_local) _local = new LocalModelProvider();
  return _local;
}
export function getCloudProvider() {
  if (!_cloud) _cloud = new CloudProvider();
  return _cloud;
}

// Resolve providers usable in the current mode. In local/air-gap mode the
// cloud provider is excluded unconditionally.
export function resolveProviders() {
  const providers = [getLocalProvider()];
  if (!sovereign.isLocal) providers.push(getCloudProvider());
  return providers;
}

export function providerList() {
  return [
    { name: 'local', kind: 'local', endpoint: sovereign.provider.baseUrl, allowedInAirGap: true, allowedInMode: true },
    { name: 'gemini', kind: 'cloud', allowedInAirGap: false, allowedInMode: !sovereign.isLocal },
  ];
}