import { readFileSync } from "node:fs";
import ts from "typescript";

const projectRoot = new URL("../../", import.meta.url);

/** 実際のServer Actionを読み、Next.jsと外部IOだけをテスト用依存へ置き換える。 */
export function loadServerModule(path, dependencies) {
  const modules = new Map();

  function load(url) {
    if (modules.has(url.href)) return modules.get(url.href).exports;
    const loadedModule = { exports: {} };
    modules.set(url.href, loadedModule);
    const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    const requireDependency = (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      if (specifier.startsWith("@/")) {
        return load(new URL(`src/${specifier.slice(2)}.ts`, projectRoot));
      }
      if (specifier.startsWith(".")) return load(new URL(specifier, url));
      throw new Error(`テストで未指定の依存: ${specifier}`);
    };
    // 信頼済みのリポジトリ内ソースだけを実行する。アプリ本体には組み込まない。
    new Function("require", "module", "exports", outputText)(
      requireDependency, loadedModule, loadedModule.exports
    );
    return loadedModule.exports;
  }

  return load(new URL(path, projectRoot));
}
