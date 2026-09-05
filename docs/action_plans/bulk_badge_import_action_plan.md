# Action Plan: Bulk Badge Import QR Scan Optimization

- [x] Step 1: Create helper utility `frontend/src/utils/badgeQrHelper.js` for payload parsing, roster matching, and canvas crop coordinates
- [x] Step 2: Create unit tests in `frontend/src/utils/badgeQrHelper.test.js`
- [x] Step 3: Update `frontend/src/pages/BulkBadgeImportPage.jsx` with multi-region scanning (bottom-right quadrant -> bottom half -> full canvas fallback)
- [x] Step 4: Update architecture document `docs/architecture/03_qr_payload.md`
- [x] Step 5: Execute targeted unit tests via Node test runner
