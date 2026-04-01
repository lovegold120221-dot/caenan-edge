'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  onStep:     (cb) => ipcRenderer.on('setup:step',     (_, d) => cb(d)),
  onLog:      (cb) => ipcRenderer.on('setup:log',      (_, m) => cb(m)),
  onComplete: (cb) => ipcRenderer.on('setup:complete', ()     => cb()),
  onError:    (cb) => ipcRenderer.on('setup:error',    (_, m) => cb(m)),
  ready:      ()   => ipcRenderer.invoke('setup:ready'),
});
