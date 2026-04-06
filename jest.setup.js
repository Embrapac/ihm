// Jest setup para jsdom
const { TextEncoder, TextDecoder } = require("util");

// Polyfill global
Object.assign(global, { TextEncoder, TextDecoder });
