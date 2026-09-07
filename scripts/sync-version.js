const fs = require('fs');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const tagIdx = args.indexOf('--tag');
const tag = tagIdx !== -1 ? args[tagIdx + 1]?.replace(/^v/, '') : null;

const cargo = fs.readFileSync('Cargo.toml', 'utf8').match(/^version = "(.+)"/m)?.[1];

if (!cargo) {
  console.error('Could not read version from Cargo.toml');
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

// Sync testing/package.json version in lockstep
const testingPkgPath = 'testing/package.json';
if (fs.existsSync(testingPkgPath)) {
  const testingPkg = JSON.parse(fs.readFileSync(testingPkgPath, 'utf8'));
  if (testingPkg.version !== cargo) {
    if (checkOnly) {
      console.error(
        `::error::testing/package.json version (${testingPkg.version}) does not match Cargo.toml (${cargo})`,
      );
      failed = true;
    } else {
      testingPkg.version = cargo;
      fs.writeFileSync(testingPkgPath, JSON.stringify(testingPkg, null, 2) + '\n');
      console.log('Synced testing/package.json version to', cargo);
    }
  } else {
    console.log('testing/package.json version in sync:', cargo);
  }
}

if (failed) process.exit(1);
