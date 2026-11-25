const { execFileSync } = require('child_process');
const path = require('path');

/**
 * electron-builder afterPack hook:
 * Ad-hoc signs the macOS .app bundle so Apple Silicon macOS executes it cleanly
 * without requiring a paid Apple Developer ID certificate.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] Ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
