const { AsyncLocalStorage } = require('async_hooks');

const sessionContext = new AsyncLocalStorage();

module.exports = sessionContext;
