import * as crypto from 'crypto';
import {
  OciClient,
  anonymousAuth,
  ManifestType,
  IMAGE_LAYER_MEDIA_TYPE,
  IMAGE_CONFIG_MEDIA_TYPE,
  OCI_IMAGE_MEDIA_TYPE,
  OCI_IMAGE_INDEX_MEDIA_TYPE,
  type ImageManifest,
  type ImageIndex,
} from '../index.js';

interface PushedImage {
  digest: string;
  rawSize: number;
}

/**
 * Push a minimal single-platform OCI image (config + one layer) and return
 * the manifest digest and raw manifest size so callers can build an ImageIndex.
 */
export async function pushPlatformImage(
  client: OciClient,
  repo: string,
  tag: string,
  arch: string,
  os: string,
): Promise<PushedImage> {
  const config = Buffer.from(
    JSON.stringify({
      architecture: arch,
      os,
      config: {},
      rootfs: { type: 'layers', diff_ids: [] },
    }),
  );
  const configDigest = `sha256:${crypto.createHash('sha256').update(config).digest('hex')}`;
  const layer = Buffer.from(`${arch}-${os}-layer-${Date.now()}`);
  const layerDigest = `sha256:${crypto.createHash('sha256').update(layer).digest('hex')}`;

  await client.pushBlob(`${repo}:${tag}`, config, configDigest);
  await client.pushBlob(`${repo}:${tag}`, layer, layerDigest);

  const manifest: ImageManifest = {
    schemaVersion: 2,
    mediaType: OCI_IMAGE_MEDIA_TYPE,
    config: {
      mediaType: IMAGE_CONFIG_MEDIA_TYPE,
      digest: configDigest,
      size: config.length,
    },
    layers: [{ mediaType: IMAGE_LAYER_MEDIA_TYPE, digest: layerDigest, size: layer.length }],
  };
  await client.pushManifest(`${repo}:${tag}`, {
    manifestType: ManifestType.Image,
    image: manifest,
  });

  const digest = await client.fetchManifestDigest(`${repo}:${tag}`, anonymousAuth());
  const raw = await client.pullManifestRaw(`${repo}:${tag}`, anonymousAuth(), [
    OCI_IMAGE_MEDIA_TYPE,
  ]);

  return { digest, rawSize: raw.length };
}

/**
 * Push a two-platform (amd64 + arm64) ImageIndex and return the per-platform
 * manifest digests so callers can verify pull results.
 */
export async function pushMultiarchImage(
  client: OciClient,
  repo: string,
): Promise<{ amd64Digest: string; arm64Digest: string }> {
  const amd64 = await pushPlatformImage(client, repo, 'amd64', 'amd64', 'linux');
  const arm64 = await pushPlatformImage(client, repo, 'arm64', 'arm64', 'linux');

  const index: ImageIndex = {
    schemaVersion: 2,
    mediaType: OCI_IMAGE_INDEX_MEDIA_TYPE,
    manifests: [
      {
        mediaType: OCI_IMAGE_MEDIA_TYPE,
        digest: amd64.digest,
        size: amd64.rawSize,
        platform: { architecture: 'amd64', os: 'linux' },
      },
      {
        mediaType: OCI_IMAGE_MEDIA_TYPE,
        digest: arm64.digest,
        size: arm64.rawSize,
        platform: { architecture: 'arm64', os: 'linux' },
      },
    ],
  };
  await client.pushManifestList(`${repo}:multiarch`, anonymousAuth(), index);

  return { amd64Digest: amd64.digest, arm64Digest: arm64.digest };
}
