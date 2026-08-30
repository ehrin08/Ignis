const { spawn } = require('node:child_process');
const { mkdir, open, rename, rm } = require('node:fs/promises');
const path = require('node:path');

function selectCompletedAndroidBuild(value) {
  const builds = Array.isArray(value) ? value : [value];
  const build = builds.find((item) => item && String(item.platform).toLowerCase() === 'android') ?? builds[0];
  if (!build || typeof build !== 'object') throw new Error('EAS did not return Android build metadata.');
  if (String(build.status).toLowerCase() !== 'finished') throw new Error(`EAS build did not finish successfully (${build.status ?? 'unknown status'}).`);

  const artifactUrl = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
  if (!artifactUrl) throw new Error('The completed EAS build has no downloadable APK artifact.');
  if (!build.appVersion || !build.appBuildVersion) throw new Error('The completed EAS build is missing version metadata.');
  return { artifactUrl, appVersion: String(build.appVersion), versionCode: String(build.appBuildVersion) };
}

function createArtifactFilename(build) {
  const safeVersion = build.appVersion.replace(/[^0-9A-Za-z.-]/g, '-');
  const safeBuild = build.versionCode.replace(/[^0-9A-Za-z.-]/g, '-');
  return `Ignis-${safeVersion}-build-${safeBuild}-release.apk`;
}

function runEasBuild() {
  const executable = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['build', '--platform', 'android', '--profile', 'production', '--wait', '--json'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['inherit', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', (error) => reject(new Error(`Could not start EAS CLI. Install it globally and sign in first. ${error.message}`)));
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`EAS build exited with code ${code}.`)));
  });
}

async function downloadArtifact(build, outputDirectory, fetchImpl = fetch) {
  await mkdir(outputDirectory, { recursive: true });
  const destination = path.join(outputDirectory, createArtifactFilename(build));
  const temporary = `${destination}.download`;
  const response = await fetchImpl(build.artifactUrl);
  if (!response.ok) throw new Error(`APK download failed with HTTP ${response.status}.`);

  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(Buffer.from(await response.arrayBuffer()));
    await handle.close();
    await rename(temporary, destination);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return destination;
}

async function main() {
  const output = await runEasBuild();
  let metadata;
  try {
    metadata = JSON.parse(output);
  } catch {
    throw new Error('EAS returned invalid JSON build metadata.');
  }
  const build = selectCompletedAndroidBuild(metadata);
  const destination = await downloadArtifact(build, path.resolve(__dirname, '..', 'dist'));
  process.stdout.write(`APK saved to ${destination}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { createArtifactFilename, downloadArtifact, selectCompletedAndroidBuild };
