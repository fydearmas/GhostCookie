import assert from 'node:assert/strict';
import test from 'node:test';

const filters = ['tracker_rules', 'easylist', 'easyprivacy', 'reputation'];
let visitRules = [];
let preferences = {};
let enabledRulesets = [...filters];
let rejectPreference = false;
globalThis.chrome = {
  storage: {
    local: {
      setAccessLevel: async () => {},
      get: async () => ({ ...preferences }),
      remove: async () => {},
      set: async (change) => {
        if (rejectPreference) throw new Error('fallo de escritura de prueba');
        preferences = { ...preferences, ...change };
      },
    },
  },
  declarativeNetRequest: {
    getEnabledRulesets: async () => enabledRulesets,
    updateEnabledRulesets: async ({ enableRulesetIds, disableRulesetIds }) => {
      enabledRulesets = [...enabledRulesets.filter((id) => !disableRulesetIds.includes(id)), ...enableRulesetIds];
    },
    getDynamicRules: async () => [],
    getSessionRules: async ({ ruleIds } = {}) => visitRules.filter(({ id }) => !ruleIds || ruleIds.includes(id)),
    updateSessionRules: async ({ addRules, removeRuleIds }) => {
      visitRules = [...visitRules.filter(({ id }) => !removeRuleIds.includes(id)), ...addRules];
    },
  },
};
const { changeVisitPause, endVisitPause, pagePolicy, readProtection, setGlobalProtection, setRegionalProtection } = await import('../background/protection.js');

test('la pausa temporal pertenece a una pestaña y termina al cambiar de dominio', async () => {
  await changeVisitPause(17, 'example.test.', true);
  const protection = await readProtection();
  assert.deepEqual(pagePolicy(protection, 'example.test', 17), { enabled: false, pause: null, visitPaused: true });
  assert.equal(pagePolicy(protection, 'example.test', 18).enabled, true);
  assert.equal(pagePolicy(protection, 'other.test', 17).enabled, true);
  assert.deepEqual(visitRules[0].condition.excludedResourceTypes, ['main_frame']);
  await endVisitPause(17, 'example.test');
  assert.equal((await readProtection()).visits.length, 1);
  await endVisitPause(17, 'other.test');
  assert.deepEqual((await readProtection()).visits, []);
});

test('guarda la elección regional y revierte las reglas si falla el guardado', async () => {
  await setRegionalProtection(true);
  assert.equal((await readProtection()).regionalEnabled, true);
  await setGlobalProtection(false);
  assert.equal((await readProtection()).regionalEnabled, false);
  assert.equal((await readProtection()).regionalPreferred, true);
  await setGlobalProtection(true);
  assert.equal((await readProtection()).regionalEnabled, true);

  rejectPreference = true;
  try {
    await assert.rejects(setRegionalProtection(false), /fallo de escritura/);
    const protection = await readProtection();
    assert.equal(protection.regionalEnabled, true);
    assert.equal(protection.regionalPreferred, true);
  } finally {
    rejectPreference = false;
  }
});
