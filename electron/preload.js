'use strict';
const { contextBridge } = require('electron');

// Expose minimal safe API to renderer
contextBridge.exposeInMainWorld('caenan', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
});
