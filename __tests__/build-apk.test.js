const { readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const { createArtifactFilename, downloadArtifact, selectCompletedAndroidBuild } = require('../scripts/build-apk');

describe('versioned APK build helper', () => {
  test('selects version metadata from a completed Android build', () => {
    expect(selectCompletedAndroidBuild([{
      platform: 'ANDROID', status: 'FINISHED', appVersion: '1.0.0', appBuildVersion: '17',
      artifacts: { applicationArchiveUrl: 'https://example.test/app.apk' },
    }])).toEqual({ artifactUrl: 'https://example.test/app.apk', appVersion: '1.0.0', versionCode: '17' });
  });

  test('rejects failed or incomplete build metadata', () => {
    expect(() => selectCompletedAndroidBuild({ platform: 'ANDROID', status: 'ERRORED' })).toThrow(/did not finish/i);
    expect(() => selectCompletedAndroidBuild({ platform: 'ANDROID', status: 'FINISHED', appVersion: '1.0.0', appBuildVersion: '2' })).toThrow(/no downloadable/i);
  });

  test('creates the approved versioned filename', () => {
    expect(createArtifactFilename({ appVersion: '1.0.0', versionCode: '17' })).toBe('Ignis-1.0.0-build-17-release.apk');
  });

  test('downloads a successful artifact into the requested directory', async () => {
    const output = path.join(tmpdir(), `ignis-apk-${process.pid}-${Date.now()}`);
    const build = { artifactUrl: 'https://example.test/app.apk', appVersion: '1.0.0', versionCode: '18' };
    try {
      const destination = await downloadArtifact(build, output, async () => ({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      }));
      expect(path.basename(destination)).toBe('Ignis-1.0.0-build-18-release.apk');
      expect([...await readFile(destination)]).toEqual([1, 2, 3]);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  test('does not leave a file after a failed download', async () => {
    const output = path.join(tmpdir(), `ignis-apk-failure-${process.pid}-${Date.now()}`);
    try {
      await expect(downloadArtifact(
        { artifactUrl: 'https://example.test/app.apk', appVersion: '1.0.0', versionCode: '19' },
        output,
        async () => ({ ok: false, status: 503 }),
      )).rejects.toThrow(/HTTP 503/);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
});
