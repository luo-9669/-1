import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPrototypeDemoAsset,
  resolvePrototypeHotspotTarget
} from '../frontend/src/services/prototypeDemo.js'

test('prototype demo uses blueprint page screenshots when compacted backend demo omits them', () => {
  const asset = buildPrototypeDemoAsset({
    projectId: 'project-jogg',
    blueprint: {
      demoScreens: [
        { id: 'home', title: 'Home / Video Podcast', screenshotUrl: 'data:image/jpeg;base64,home' },
        { id: 'studio', title: 'Studio Initial', screenshotUrl: 'data:image/jpeg;base64,studio' }
      ]
    },
    prototypeAsset: {
      id: 'asset-demo',
      projectId: 'project-jogg',
      type: 'prototype-demo',
      prototypeDemo: {
        screens: [
          { id: 'home', title: 'Home / Video Podcast', screenshotUrl: '', hotspots: [] },
          { id: 'studio', title: 'Studio Initial', hotspots: [] }
        ]
      }
    }
  })

  assert.equal(asset.screens[0].screenshotUrl, 'data:image/jpeg;base64,home')
  assert.equal(asset.screens[1].screenshotUrl, 'data:image/jpeg;base64,studio')
})

test('prototype demo resolves hotspot target urls to the captured screen chain', () => {
  const asset = buildPrototypeDemoAsset({
    projectId: 'project-jogg',
    prototypeAsset: {
      id: 'asset-demo',
      type: 'prototype-demo',
      prototypeDemo: {
        screens: [
          {
            id: 'home',
            title: 'Home',
            url: 'https://example.com/',
            hotspots: [
              {
                id: 'open-studio',
                label: 'Open studio',
                targetUrl: 'https://example.com/studio'
              }
            ]
          },
          {
            id: 'studio',
            title: 'Studio',
            route: '/studio',
            url: 'https://example.com/studio',
            hotspots: []
          }
        ]
      }
    }
  })

  assert.equal(
    resolvePrototypeHotspotTarget(asset, asset.screens[0].hotspots[0], 'home'),
    'studio'
  )
  assert.equal(
    resolvePrototypeHotspotTarget(asset, { targetUrl: '/studio' }, 'home'),
    'studio'
  )
})
