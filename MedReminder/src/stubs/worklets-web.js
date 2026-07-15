'use strict';
/**
 * Web stub for react-native-worklets.
 *
 * react-native-worklets uses import.meta (for Web Worker setup) which is
 * incompatible with Metro's CommonJS web output. On web, react-native-reanimated
 * v4 uses its own browser implementation that doesn't need worklets, so we can
 * safely replace this package with no-ops.
 */

const identity = (v) => v;
const noop = () => {};
const noopFn = (fn) => fn;

module.exports = {
  makeShareable: identity,
  makeShareableCloneRecursive: identity,
  makeWorklet: noopFn,
  makeRemoteFunction: noopFn,
  runOnUI: noopFn,
  runOnJS: noopFn,
  isWorklet: () => false,
  startMapper: () => 0,
  stopMapper: noop,
  registerEventHandler: () => 0,
  unregisterEventHandler: noop,
  getViewProp: () => Promise.resolve(null),
  enableLayoutAnimations: noop,
  WorkletsModule: {
    makeShareable: identity,
    makeShareableCloneRecursive: identity,
    scheduleOnUI: (fn, ...args) => { fn(...args); },
    executeOnUIRuntimeSync: (fn) => fn(),
  },
  default: {},
};
