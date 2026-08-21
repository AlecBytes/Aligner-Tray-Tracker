import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'src');
const appRoot = path.join(sourceRoot, 'app');

const codeExtensions = [
  '.ios.tsx',
  '.ios.ts',
  '.ios.jsx',
  '.ios.js',
  '.native.tsx',
  '.native.ts',
  '.native.jsx',
  '.native.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
];

const approvedReactNativeRuntimeImports = new Set([
  'AppState',
  'Linking',
  'Platform',
  'useColorScheme',
]);

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function isCodeFile(filePath) {
  return codeExtensions.some((extension) => filePath.endsWith(extension));
}

function isTestFile(filePath) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath);
}

function platformRank(filePath) {
  if (/\.ios\.[cm]?[jt]sx?$/.test(filePath)) {
    return 0;
  }
  if (/\.native\.[cm]?[jt]sx?$/.test(filePath)) {
    return 1;
  }
  if (/\.(?:android|web)\.[cm]?[jt]sx?$/.test(filePath)) {
    return Number.POSITIVE_INFINITY;
  }
  return 2;
}

function logicalModulePath(filePath) {
  return filePath.replace(/\.(?:ios|native|android|web)(?=\.[cm]?[jt]sx?$)/, '');
}

function discoverRoots() {
  const routeRoots = new Map();

  for (const filePath of walkFiles(appRoot).filter(isCodeFile).filter((filePath) => !isTestFile(filePath))) {
    const rank = platformRank(filePath);
    if (!Number.isFinite(rank)) {
      continue;
    }

    const logicalPath = logicalModulePath(filePath);
    const selected = routeRoots.get(logicalPath);
    if (!selected || rank < selected.rank) {
      routeRoots.set(logicalPath, { filePath, rank });
    }
  }

  const iosModules = walkFiles(sourceRoot).filter(
    (filePath) => /\.ios\.[cm]?[jt]sx?$/.test(filePath) && !isTestFile(filePath),
  );

  return [...new Set([...routeRoots.values()].map(({ filePath }) => filePath).concat(iosModules))].sort();
}

function resolveAppModule(importerPath, specifier) {
  let basePath;

  if (specifier.startsWith('@/assets/')) {
    basePath = path.join(projectRoot, 'assets', specifier.slice('@/assets/'.length));
  } else if (specifier.startsWith('@/')) {
    basePath = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(importerPath), specifier);
  } else {
    return null;
  }

  if (isCodeFile(basePath) && fs.existsSync(basePath)) {
    return basePath;
  }

  for (const extension of codeExtensions) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const extension of codeExtensions) {
    const candidate = path.join(basePath, `index${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function moduleName(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function isReactNativeModule(specifier) {
  return specifier === 'react-native' || specifier?.startsWith('react-native/');
}

function isRuntimeImportClause(importClause) {
  if (!importClause || importClause.isTypeOnly) {
    return false;
  }

  if (importClause.name) {
    return true;
  }

  const bindings = importClause.namedBindings;
  if (!bindings || ts.isNamespaceImport(bindings)) {
    return Boolean(bindings);
  }

  return bindings.elements.some((element) => !element.isTypeOnly);
}

function collectRuntimeSpecifiers(sourceFile) {
  const specifiers = [];

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      if (isRuntimeImportClause(node.importClause) || !node.importClause) {
        const specifier = moduleName(node.moduleSpecifier);
        if (specifier) specifiers.push(specifier);
      }
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const specifier = moduleName(node.moduleSpecifier);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference)) {
        const specifier = moduleName(reference.expression);
        if (specifier) specifiers.push(specifier);
      }
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) {
        const specifier = moduleName(node.arguments[0]);
        if (specifier) specifiers.push(specifier);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function addViolation(violations, filePath, node, sourceFile, message) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push({
    filePath: path.relative(projectRoot, filePath),
    line: position.line + 1,
    column: position.character + 1,
    message,
  });
}

function auditReactNativeImports(filePath, sourceFile, violations) {
  function auditImportClause(node, importClause) {
    if (!importClause || importClause.isTypeOnly) {
      if (!importClause) {
        addViolation(violations, filePath, node, sourceFile, 'Side-effect imports from react-native are not allowed.');
      }
      return;
    }

    if (importClause.name) {
      addViolation(violations, filePath, node, sourceFile, 'Default imports from react-native are not allowed.');
    }

    const bindings = importClause.namedBindings;
    if (!bindings) {
      return;
    }

    if (ts.isNamespaceImport(bindings)) {
      addViolation(violations, filePath, node, sourceFile, 'Namespace imports from react-native are not allowed.');
      return;
    }

    for (const element of bindings.elements) {
      if (element.isTypeOnly) {
        continue;
      }
      const importedName = element.propertyName?.text ?? element.name.text;
      if (!approvedReactNativeRuntimeImports.has(importedName)) {
        addViolation(
          violations,
          filePath,
          element,
          sourceFile,
          `react-native runtime import ${importedName} is not an approved non-visual iOS API.`,
        );
      }
    }
  }

  function auditSafeAreaContextClause(node, importClause) {
    if (!importClause || importClause.isTypeOnly) {
      return;
    }

    if (importClause.name) {
      addViolation(
        violations,
        filePath,
        node,
        sourceFile,
        'Default access to react-native-safe-area-context is not allowed in the iOS UI graph.',
      );
    }

    const bindings = importClause.namedBindings;
    if (!bindings) {
      return;
    }

    if (ts.isNamespaceImport(bindings)) {
      addViolation(
        violations,
        filePath,
        node,
        sourceFile,
        'Namespace access to react-native-safe-area-context could bypass the SafeAreaView restriction.',
      );
      return;
    }

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (!element.isTypeOnly && importedName === 'SafeAreaView') {
        addViolation(
          violations,
          filePath,
          element,
          sourceFile,
          'react-native-safe-area-context SafeAreaView is visual UI and is not allowed on iOS.',
        );
      }
    }
  }

  function visit(node) {
    const importSpecifier = ts.isImportDeclaration(node) ? moduleName(node.moduleSpecifier) : null;
    const exportSpecifier = ts.isExportDeclaration(node) ? moduleName(node.moduleSpecifier) : null;

    if (ts.isImportDeclaration(node) && importSpecifier === 'react-native') {
      auditImportClause(node, node.importClause);
    } else if (ts.isImportDeclaration(node) && isReactNativeModule(importSpecifier)) {
      if (isRuntimeImportClause(node.importClause) || !node.importClause) {
        addViolation(
          violations,
          filePath,
          node,
          sourceFile,
          `Direct React Native subpath import ${importSpecifier} is not allowed in the iOS UI graph.`,
        );
      }
    } else if (ts.isImportDeclaration(node) && importSpecifier === 'react-native-safe-area-context') {
      auditSafeAreaContextClause(node, node.importClause);
    } else if (ts.isExportDeclaration(node) && exportSpecifier === 'react-native') {
      if (node.isTypeOnly) {
        return;
      }
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
        addViolation(violations, filePath, node, sourceFile, 'Wildcard exports from react-native are not allowed.');
      } else {
        for (const element of node.exportClause.elements) {
          if (element.isTypeOnly) {
            continue;
          }
          const exportedName = element.propertyName?.text ?? element.name.text;
          if (!approvedReactNativeRuntimeImports.has(exportedName)) {
            addViolation(
              violations,
              filePath,
              element,
              sourceFile,
              `react-native runtime export ${exportedName} is not an approved non-visual iOS API.`,
            );
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && isReactNativeModule(exportSpecifier) && !node.isTypeOnly) {
      addViolation(
        violations,
        filePath,
        node,
        sourceFile,
        `Direct React Native subpath export ${exportSpecifier} is not allowed in the iOS UI graph.`,
      );
    } else if (
      ts.isExportDeclaration(node) &&
      exportSpecifier === 'react-native-safe-area-context' &&
      !node.isTypeOnly
    ) {
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
        addViolation(
          violations,
          filePath,
          node,
          sourceFile,
          'Wildcard access to react-native-safe-area-context could bypass the SafeAreaView restriction.',
        );
      } else {
        for (const element of node.exportClause.elements) {
          const exportedName = element.propertyName?.text ?? element.name.text;
          if (!element.isTypeOnly && exportedName === 'SafeAreaView') {
            addViolation(
              violations,
              filePath,
              element,
              sourceFile,
              'react-native-safe-area-context SafeAreaView is visual UI and is not allowed on iOS.',
            );
          }
        }
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      (isReactNativeModule(moduleName(node.moduleReference.expression)) ||
        moduleName(node.moduleReference.expression) === 'react-native-safe-area-context') &&
      !node.isTypeOnly
    ) {
      addViolation(violations, filePath, node, sourceFile, 'Import-equals access to React Native UI is not allowed.');
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const specifier = moduleName(node.arguments[0]);
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (
        (isReactNativeModule(specifier) || specifier === 'react-native-safe-area-context') &&
        (isDynamicImport || isRequire)
      ) {
        addViolation(violations, filePath, node, sourceFile, 'Dynamic access to React Native UI is not allowed.');
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const roots = discoverRoots();
const pending = [...roots];
const visited = new Set();
const violations = [];

while (pending.length > 0) {
  const filePath = pending.pop();
  if (!filePath || visited.has(filePath)) {
    continue;
  }

  visited.add(filePath);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

  auditReactNativeImports(filePath, sourceFile, violations);

  for (const specifier of collectRuntimeSpecifiers(sourceFile)) {
    const resolved = resolveAppModule(filePath, specifier);
    if (resolved && resolved.startsWith(sourceRoot) && !visited.has(resolved)) {
      pending.push(resolved);
    }
  }
}

if (violations.length > 0) {
  console.error('iOS UI purity check failed:');
  for (const violation of violations.sort((left, right) =>
    `${left.filePath}:${left.line}:${left.column}`.localeCompare(`${right.filePath}:${right.line}:${right.column}`),
  )) {
    console.error(`${violation.filePath}:${violation.line}:${violation.column} ${violation.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `iOS UI purity check passed (${visited.size} app-owned modules reachable from ${roots.length} iOS route/override roots).`,
  );
}
