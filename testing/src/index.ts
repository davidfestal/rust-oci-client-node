export {
  MockRegistry,
  generateTlsCerts,
  MANIFEST_DIGEST,
  CONFIG_DIGEST,
  BLOB_DIGEST,
  AMD64_MANIFEST_DIGEST,
  ARM64_MANIFEST_DIGEST,
  IMAGE_INDEX_DIGEST,
} from './mock-registry.js';
export type { MockConfig } from './mock-registry.js';

export {
  ZotRegistry,
  shouldSkipZotTests,
  detectContainerRuntime,
  findAvailablePort,
  isPortAvailable,
  waitForRegistry,
  CONTAINER_NAME_PREFIX,
  ZOT_IMAGE,
} from './zot-registry.js';
export type { ContainerRuntime } from './zot-registry.js';
