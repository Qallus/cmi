const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('../apps/cmi-next/node_modules/typescript');
const app = path.resolve(__dirname, '../apps/cmi-next') + path.sep;
function evaluate(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(app + file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (!(name in dependencies)) throw new Error('Unexpected import: ' + name);
    return dependencies[name];
  }});
  return exports;
}
const access = evaluate('lib/take-off/access.ts');
const allowed = ['super_admin', 'admin', 'project_manager', 'estimator'];
const denied = ['staff', 'designer', 'superintendent', 'subcontractor', 'vendor', 'client', 'viewer', 'unknown', '', null, undefined];
async function invoke(staff, enabled) {
  let flagReads = 0;
  const page = evaluate('app/dashboard/take-off/page.tsx', {
    'next/navigation': { notFound() { throw new Error('404'); }, redirect(path) { throw new Error('redirect:' + path); } },
    '@/lib/auth/server-session': { getSessionStaff: async () => staff },
    '@/lib/flags': { isFeatureEnabled: async (key) => { assert.equal(key, 'take_off'); flagReads++; return enabled === true; } },
    '@/lib/take-off/access': access,
    '@/components/take-off/take-off-module': { default: 'TakeOffModule' },
    'react/jsx-runtime': { jsx: (type) => type },
  });
  try { return { result: await page.default(), flagReads }; }
  catch (error) { return { result: error.message, flagReads }; }
}
test('logged-out requests redirect before reading flags', async () => {
  assert.deepEqual(await invoke(null, true), { result: 'redirect:/login', flagReads: 0 });
});
for (const role of allowed) {
  test(role + ' can render only with enabled flag', async () => {
    assert.deepEqual(await invoke({ role_slug: role }, true), { result: 'TakeOffModule', flagReads: 1 });
    for (const flag of [false, undefined]) assert.deepEqual(await invoke({ role_slug: role }, flag), { result: '404', flagReads: 1 });
  });
}
for (const role of denied) {
  test(String(role) + ' cannot access costs even with enabled flag', async () => {
    assert.deepEqual(await invoke({ role_slug: role }, true), { result: '404', flagReads: 0 });
  });
}
