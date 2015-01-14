"use strict";

require("6to5/polyfill");
var _ = require("lodash");
var should = require("should");
var Promise = (global || window).Promise = require("bluebird");
var __DEV__ = process.env.NODE_ENV !== "production";
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === "object";
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
module.exports = {
  // this is just a disambiguation salt; this is by no mean a cryptographic
  // device. this does NOT prevent active eavesdropping over inscured channel.
  DEFAULT_SALT: "__ZQ8Ykv8HQVtWWyznJZax9uJS" };