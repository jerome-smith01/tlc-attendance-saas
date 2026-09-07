import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Scanner Layout & Action Card Configuration', () => {
  const globalCssPath = path.join(rootDir, 'frontend', 'src', 'styles', 'global.css');
  const scannerJsxPath = path.join(rootDir, 'frontend', 'src', 'pages', 'Scanner.jsx');

  const globalCss = fs.readFileSync(globalCssPath, 'utf8');
  const scannerJsx = fs.readFileSync(scannerJsxPath, 'utf8');

  describe('CSS Settings (.scanner-btn-delete & .scanner-hero-section)', () => {
    test('defines .scanner-btn-delete in global.css', () => {
      assert.ok(globalCss.includes('.scanner-btn-delete {'), 'global.css should define .scanner-btn-delete');
      assert.ok(globalCss.includes('var(--color-error, #dc2626)'), 'global.css should use error color variable');
      assert.ok(globalCss.includes('.scanner-btn-delete:hover:not(:disabled)'), 'should define hover state');
      assert.ok(globalCss.includes('.scanner-btn-delete:focus-visible'), 'should define focus-visible state');
      assert.ok(globalCss.includes('.scanner-btn-delete:disabled'), 'should define disabled state');
    });

    test('defines 3-column layout classes for .scanner-hero-section', () => {
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-actions-panel'), 'hero section should configure actions panel');
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-feed-container'), 'hero section should configure feed container');
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-header-card'), 'hero section should configure header card');
    });
  });

  describe('Scanner.jsx Layout Order', () => {
    test('positions scanner-actions-panel on the left before scanner-feed-container and scanner-header-card', () => {
      const heroSectionIdx = scannerJsx.indexOf('className="scanner-hero-section"');
      const attendanceHeaderIdx = scannerJsx.indexOf('className="attendance-section-header"');
      assert.ok(heroSectionIdx !== -1, 'scanner-hero-section should exist');
      assert.ok(attendanceHeaderIdx !== -1, 'attendance-section-header should exist');

      const heroSlice = scannerJsx.slice(heroSectionIdx, attendanceHeaderIdx);

      const actionsPanelIdx = heroSlice.indexOf('className="scanner-actions-panel"');
      const feedContainerIdx = heroSlice.indexOf('className="scanner-feed-container"');
      const headerCardIdx = heroSlice.indexOf('className="scanner-header-card"');

      assert.ok(actionsPanelIdx !== -1, 'scanner-actions-panel should exist in hero section');
      assert.ok(feedContainerIdx !== -1, 'scanner-feed-container should exist in hero section');
      assert.ok(headerCardIdx !== -1, 'scanner-header-card should exist in hero section');

      // Left -> Center -> Right ordering
      assert.ok(
        actionsPanelIdx < feedContainerIdx,
        `Actions panel (idx: ${actionsPanelIdx}) should appear before feed container (idx: ${feedContainerIdx})`
      );
      assert.ok(
        feedContainerIdx < headerCardIdx,
        `Feed container (idx: ${feedContainerIdx}) should appear before header card (idx: ${headerCardIdx})`
      );
    });

    test('nests .scanner-btn-delete inside .scanner-action-card', () => {
      const actionCardStart = scannerJsx.indexOf('className="scanner-action-card"');
      assert.ok(actionCardStart !== -1, 'scanner-action-card should exist');

      // Find the end of scanner-action-card
      const afterActionCard = scannerJsx.slice(actionCardStart);
      const deleteBtnIdx = afterActionCard.indexOf('className="scanner-btn-delete"');
      const feedContainerIdx = afterActionCard.indexOf('className="scanner-feed-container"');

      assert.ok(deleteBtnIdx !== -1, 'scanner-btn-delete should exist');
      assert.ok(
        deleteBtnIdx < feedContainerIdx,
        'scanner-btn-delete should be located inside action panel before feed container'
      );
      assert.ok(
        afterActionCard.slice(0, deleteBtnIdx).includes('scanner-secondary-actions-box'),
        'scanner-btn-delete should be placed after secondary actions box'
      );
    });
  });
});
