const fs = require('fs');
const path = require('path');

function patchFile(filePath, fromStr, toStr) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(fromStr)) {
    content = content.replace(fromStr, toStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-screens] Patched: ${filePath}`);
    return true;
  } else if (content.includes(toStr)) {
    console.log(`[patch-screens] Already patched: ${filePath}`);
    return true;
  }
  return false;
}

const possibleRoots = [
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../packages/mobile'),
];

let applied = false;
for (const root of possibleRoots) {
  const tsPath = path.join(
    root,
    'node_modules/react-native-screens/src/fabric/gamma/stack/StackHeaderConfigAndroidNativeComponent.ts'
  );
  if (
    patchFile(
      tsPath,
      'viewRef: React.ComponentRef<ComponentType>,',
      'viewRef: React.ElementRef<ComponentType>,'
    )
  ) {
    applied = true;
  }

  const dtsPath = path.join(
    root,
    'node_modules/react-native-screens/lib/typescript/fabric/gamma/stack/StackHeaderConfigAndroidNativeComponent.d.ts'
  );
  patchFile(
    dtsPath,
    'viewRef: React.ComponentRef<ComponentType>,',
    'viewRef: React.ElementRef<ComponentType>,'
  );
}

if (!applied) {
  console.log('[patch-screens] Warning: react-native-screens component file not found to patch');
}
