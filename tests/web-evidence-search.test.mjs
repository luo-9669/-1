import assert from 'node:assert/strict'
import test from 'node:test'

import { parseBingResults } from '../backend/services/web-evidence-search.js'

test('web evidence search parses Bing result cards as usable sources', () => {
  const html = `
    <html>
      <body>
        <ol>
          <li class="b_algo">
            <h2><a href="https://example.com/product-analysis">AI video product analysis</a></h2>
            <div class="b_caption">
              <p>Market examples and product feature notes for AI video tools.</p>
            </div>
          </li>
          <li class="b_algo">
            <h2><a href="https://example.org/competitor-report">Competitor report</a></h2>
            <div class="b_caption">
              <p>Competitive workflow details for web based video generation.</p>
            </div>
          </li>
        </ol>
      </body>
    </html>
  `

  const results = parseBingResults(html, 'AI视频爆款复刻 Web 工具')

  assert.equal(results.length, 2)
  assert.equal(results[0].title, 'AI video product analysis')
  assert.equal(results[0].url, 'https://example.com/product-analysis')
  assert.equal(results[0].snippet, 'Market examples and product feature notes for AI video tools.')
  assert.equal(results[0].sourceType, 'web-search')
  assert.equal(results[0].query, 'AI视频爆款复刻 Web 工具')
})
