const fs = require('fs');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const tagIdx = args.indexOf('--tag');
const tag = tagIdx !== -1 ? args[tagIdx + 1]?.replace(/^v/, '') : null;

const cargoToml = fs.readFileSync('Cargo.toml', 'utf8');
const cargo = cargoToml.match(/^version = "(.+)"/m)?.[1];

if (!cargo) {
  console.error('Could not read version from Cargo.toml');
  process.exit(1);
}

// Helper to strip -prerelease and +build metadata
const getBaseVersion = (v) => (v ? v.split(/[-+]/)[0] : '');

const ociClientDep = cargoToml.match(/^\s*oci-client\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/m)?.[1];
if (!ociClientDep) {
  console.error('Could not read oci-client dependency version from Cargo.toml');
  process.exit(1);
}

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

console.log(`Cargo.toml: ${cargo} | package.json: ${pkg.version}${tag ? ` | tag: ${tag}` : ''}`);

let failed = false;

if (tag && cargo !== tag) {
  console.error(`::error::Cargo.toml version (${cargo}) does not match git tag (${tag})`);
  failed = true;
}

// 1. package.json version must match Cargo.toml package version exactly
if (pkg.version !== cargo) {
  if (checkOnly) {
    console.error(
      `::error::package.json version (${pkg.version}) does not match Cargo.toml (${cargo})`,
    );
    failed = true;
  } else {
    pkg.version = cargo;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Synced package.json version to', cargo);
  }
} else {
  console.log('Versions in sync:', cargo);
}

// 2. Shared version base must match the oci-client dependency version
const cargoBase = getBaseVersion(cargo);
if (cargoBase !== ociClientDep) {
  if (checkOnly) {
    console.error(
      `::error::Cargo.toml version base (${cargoBase}) does not match oci-client dependency (${ociClientDep})`,
    );
    failed = true;
  } else {
    let updatedCargoToml = fs.readFileSync('Cargo.toml', 'utf8');
    const depPattern = /^(\s*oci-client\s*=\s*\{[^}]*version\s*=\s*")[^"]+(")/m;
    updatedCargoToml = updatedCargoToml.replace(depPattern, `$1${cargoBase}$2`);
    fs.writeFileSync('Cargo.toml', updatedCargoToml);
    console.log('Synced oci-client dependency version to', cargoBase);
  }
} else {
  console.log('oci-client dependency base in sync:', ociClientDep);
}

// 3. Keep testing/package.json version and peer in lockstep with Cargo.toml
const testingPkgPath = 'testing/package.json';
const peerName = '@oras-project/oci-client';
if (fs.existsSync(testingPkgPath)) {
  const testingPkg = JSON.parse(fs.readFileSync(testingPkgPath, 'utf8'));
  const peer = testingPkg.peerDependencies?.[peerName];
  let testingDirty = false;

  if (testingPkg.version !== cargo) {
    if (checkOnly) {
      console.error(
        `::error::testing/package.json version (${testingPkg.version}) does not match Cargo.toml (${cargo})`,
      );
      failed = true;
    } else {
      testingPkg.version = cargo;
      testingDirty = true;
      console.log('Synced testing/package.json version to', cargo);
    }
  } else {
    console.log('testing/package.json version in sync:', cargo);
  }

  if (peer !== cargo) {
    if (checkOnly) {
      console.error(
        `::error::testing/package.json peerDependencies["${peerName}"] (${peer}) does not match Cargo.toml (${cargo})`,
      );
      failed = true;
    } else {
      testingPkg.peerDependencies = { ...testingPkg.peerDependencies, [peerName]: cargo };
      testingDirty = true;
      console.log(`Synced testing/package.json peerDependencies["${peerName}"] to`, cargo);
    }
  } else {
    console.log(`testing/package.json peerDependencies["${peerName}"] in sync:`, cargo);
  }

  if (testingDirty) {
    fs.writeFileSync(testingPkgPath, JSON.stringify(testingPkg, null, 2) + '\n');
  }
}

// yarn.lock records the testing workspace peer. The script does not rewrite it;
// a stale peer fails with instructions to run `yarn install`.
const lockPath = 'yarn.lock';
const testingWorkspaceKey = '@oras-project/oci-client-testing@workspace:testing';

function testingWorkspaceBlock(text) {
  const header = `"${testingWorkspaceKey}":\n`;
  const start = text.indexOf(header);
  if (start < 0) return null;
  const bodyStart = start + header.length;
  const nextHeader = text.indexOf('\n"', bodyStart);
  const end = nextHeader === -1 ? text.length : nextHeader + 1;
  return text.slice(bodyStart, end);
}

function readLockPeer(block, name) {
  const peerSection = block.match(/^  peerDependencies:\n([\s\S]*?)(?=^  \S|\s*$)/m);
  if (!peerSection) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = peerSection[1].match(new RegExp(`^    "${escaped}": (.+)$`, 'm'));
  if (!match) return null;
  const raw = match[1];
  return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
}

if (fs.existsSync(lockPath)) {
  const lockText = fs.readFileSync(lockPath, 'utf8');
  const block = testingWorkspaceBlock(lockText);
  const lockPeer = block && readLockPeer(block, peerName);
  if (!block || !lockPeer) {
    if (checkOnly) {
      console.error(
        `::error::${lockPath} has no peerDependencies["${peerName}"] entry for ${testingWorkspaceKey}. Run \`yarn install\` to regenerate it.`,
      );
      failed = true;
    } else {
      console.warn(
        `Warning: ${lockPath} has no peerDependencies["${peerName}"] entry for ${testingWorkspaceKey}. Run \`yarn install\` to regenerate it.`,
      );
    }
  } else if (lockPeer !== cargo) {
    if (checkOnly) {
      console.error(
        `::error::${lockPath} peerDependencies["${peerName}"] (${lockPeer}) does not match Cargo.toml (${cargo}). Run \`yarn install\` to refresh ${lockPath}.`,
      );
      failed = true;
    } else {
      console.warn(
        `Warning: ${lockPath} peerDependencies["${peerName}"] (${lockPeer}) does not match Cargo.toml (${cargo}). Run \`yarn install\` to refresh ${lockPath}.`,
      );
    }
  } else {
    console.log(`${lockPath} peerDependencies["${peerName}"] in sync:`, cargo);
  }
}

if (failed) process.exit(1);
