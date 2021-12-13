'use strict';

var define = require('define-properties');
var callBind = require('call-bind');

var implementation = require('./regexplib/implementation');
var getPolyfill = require('./regexplib/polyfill');
var shim = require('./regexplib/shim');

var flagsBound = callBind(implementation);

define(flagsBound, {
	getPolyfill: getPolyfill,
	implementation: implementation,
	shim: shim
});

module.exports = flagsBound;
