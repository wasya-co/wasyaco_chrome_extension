import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  permissions: [
    'sidePanel',
    'contentSettings',
    'tabs',
    'scripting',
  ],
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  chrome_url_overrides: {
    newtab: "src/clock/clock.html",
  },
  content_scripts: [{
    js: ['src/content/main.jsx'],
    matches: ['https://*/*'],
  }],
  host_permissions: [
    'http://*/*',
    'https://*/*',
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
