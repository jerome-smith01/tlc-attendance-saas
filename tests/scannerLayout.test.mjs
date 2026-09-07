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

  describe('CSS Settings (.scanner-btn-delete, .scanner-card-title, & .scanner-hero-section)', () => {
    test('defines .scanner-btn-delete in global.css with right-alignment and states', () => {
      assert.ok(globalCss.includes('.scanner-btn-delete {'), 'global.css should define .scanner-btn-delete');
      assert.ok(globalCss.includes('align-self: flex-end;'), 'should align self to flex-end (right aligned)');
      assert.ok(globalCss.includes('var(--color-error, #dc2626)'), 'global.css should use error color variable');
      assert.ok(globalCss.includes('.scanner-btn-delete:hover:not(:disabled)'), 'should define hover state');
      assert.ok(globalCss.includes('.scanner-btn-delete:focus-visible'), 'should define focus-visible state');
      assert.ok(globalCss.includes('.scanner-btn-delete:disabled'), 'should define disabled state');
    });

    test('defines .scanner-card-title in global.css matching Attendance header style', () => {
      assert.ok(globalCss.includes('.scanner-card-title {'), 'global.css should define .scanner-card-title');
      assert.ok(globalCss.includes('font-size: 1.1rem;'), 'should have 1.1rem font size');
      assert.ok(globalCss.includes('font-weight: 700;'), 'should have bold 700 font weight');
      assert.ok(globalCss.includes('margin: 0;'), 'should have margin 0');
    });

    test('defines 3-column layout classes for .scanner-hero-section', () => {
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-actions-panel'), 'hero section should configure actions panel');
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-feed-container'), 'hero section should configure feed container');
      assert.ok(globalCss.includes('.scanner-hero-section .scanner-header-card'), 'hero section should configure header card');
    });
  });

  describe('Scanner.jsx Layout Order & Semantic Headings', () => {
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

    test('renders Scanner Actions as an h3 heading with .scanner-card-title', () => {
      const actionCardStart = scannerJsx.indexOf('className="scanner-action-card"');
      const feedContainerStart = scannerJsx.indexOf('className="scanner-feed-container"');
      const actionCardContent = scannerJsx.slice(actionCardStart, feedContainerStart);

      assert.ok(
        actionCardContent.includes('<h3 className="scanner-card-title"'),
        'scanner-action-card should render an h3 with scanner-card-title'
      );
      assert.ok(
        actionCardContent.includes('Scanner Actions</h3>'),
        'scanner-action-card should display "Scanner Actions" title'
      );
    });

    test('renders Event Info as an h3 heading with .scanner-card-title in scanner-header-card', () => {
      const headerCardStart = scannerJsx.indexOf('className="scanner-header-card"');
      const attendanceHeaderStart = scannerJsx.indexOf('className="attendance-section-header"');
      const headerCardContent = scannerJsx.slice(headerCardStart, attendanceHeaderStart);

      assert.ok(
        headerCardContent.includes('<h3 className="scanner-card-title"'),
        'scanner-header-card should render an h3 with scanner-card-title'
      );
      assert.ok(
        headerCardContent.includes('Event Info</h3>'),
        'scanner-header-card should display "Event Info" title'
      );
    });

    test('nests .scanner-btn-delete inside .scanner-header-card and not inside .scanner-action-card', () => {
      const actionCardStart = scannerJsx.indexOf('className="scanner-action-card"');
      const feedContainerStart = scannerJsx.indexOf('className="scanner-feed-container"');
      const headerCardStart = scannerJsx.indexOf('className="scanner-header-card"');
      const attendanceHeaderStart = scannerJsx.indexOf('className="attendance-section-header"');

      assert.ok(actionCardStart !== -1, 'scanner-action-card should exist');
      assert.ok(headerCardStart !== -1, 'scanner-header-card should exist');

      // Verify NOT in scanner-action-card
      const actionCardContent = scannerJsx.slice(actionCardStart, feedContainerStart);
      assert.ok(
        !actionCardContent.includes('className="scanner-btn-delete"'),
        'scanner-action-card should not contain .scanner-btn-delete'
      );

      // Verify IN scanner-header-card
      const headerCardContent = scannerJsx.slice(headerCardStart, attendanceHeaderStart);
      assert.ok(
        headerCardContent.includes('className="scanner-btn-delete"'),
        'scanner-header-card should contain .scanner-btn-delete'
      );
    });
  });
});
