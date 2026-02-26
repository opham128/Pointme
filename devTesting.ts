/**
 * Dev-only helpers for testing. Call from React Native debugger console or tests.
 * In __DEV__ only; no-op in production.
 *
 * Usage (in app, with debugger connected):
 *   global.__pointmeDev.clearStorage()
 *   global.__pointmeDev.togglePurchase()
 *   global.__pointmeDev.setFreeUser()     // set as free user (reload app to see)
 *   global.__pointmeDev.setPaidUser()     // set as paid user (reload app to see)
 *   global.__pointmeDev.testArrival()     // when on Compass screen
 *   global.__pointmeDev.testPulse(100)    // 100 = simulate 100ft for pulse; testPulse() clears
 *
 * In Chrome/browser debugger (no global), use window instead:
 *   window.__pointmeDev.setFreeUser()
 *   window.__pointmeDev.setPaidUser()
 *   window.__pointmeDev.testArrival()     // open Compass screen first
 *   window.__pointmeDev.testPulse(100)
 */

import { clearAllStorage } from './services/storage';
import { togglePurchaseStatusDebug, setPurchaseStatusDebug } from './services/purchases';

export async function clearStorageForTesting(): Promise<void> {
  if (!__DEV__) return;
  await clearAllStorage();
  console.warn('[devTesting] Storage cleared. Reload or re-open history to see updated count.');
}

export async function togglePurchaseForTesting(): Promise<boolean> {
  if (!__DEV__) return false;
  const newStatus = await togglePurchaseStatusDebug();
  console.warn('[devTesting] Purchase status toggled:', newStatus ? 'PAID' : 'FREE');
  return newStatus;
}

export async function setFreeUserForTesting(): Promise<void> {
  if (!__DEV__) return;
  await setPurchaseStatusDebug(false);
  console.warn('[devTesting] Set as FREE user. Reload the app to see the change.');
}

export async function setPaidUserForTesting(): Promise<void> {
  if (!__DEV__) return;
  await setPurchaseStatusDebug(true);
  console.warn('[devTesting] Set as PAID user. Reload the app to see the change.');
}

// Compass screen registers these so testArrival / testPulse can be called from console
type DevCompassRegistry = {
  testArrival: () => void;
  testPulse: (feet: number | null) => void;
};
let compassRegistry: DevCompassRegistry | null = null;

export function registerCompassDevHandlers(handlers: DevCompassRegistry): () => void {
  if (!__DEV__) return () => {};
  compassRegistry = handlers;
  return () => {
    compassRegistry = null;
  };
}

function testArrivalFromDev(): void {
  if (!__DEV__ || !compassRegistry) {
    console.warn('[devTesting] testArrival: open Compass screen first.');
    return;
  }
  compassRegistry.testArrival();
}

function testPulseFromDev(feet: number | null = 100): void {
  if (!__DEV__ || !compassRegistry) {
    console.warn('[devTesting] testPulse: open Compass screen first.');
    return;
  }
  compassRegistry.testPulse(feet === undefined ? 100 : feet);
}

declare let global: { __pointmeDev?: typeof pointmeDev };
declare let window: { __pointmeDev?: typeof pointmeDev };

const pointmeDev = {
  clearStorage: clearStorageForTesting,
  togglePurchase: togglePurchaseForTesting,
  setFreeUser: setFreeUserForTesting,
  setPaidUser: setPaidUserForTesting,
  testArrival: testArrivalFromDev,
  testPulse: testPulseFromDev,
};

if (__DEV__) {
  if (typeof global !== 'undefined') global.__pointmeDev = pointmeDev;
  if (typeof window !== 'undefined') window.__pointmeDev = pointmeDev;
}
