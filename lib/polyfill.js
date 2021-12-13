'use strict';

var implementation = require('./implementation').default;

module.exports = function getPolyfill() {
	return typeof Object.is === 'function' ? Object.is : implementation;
};
