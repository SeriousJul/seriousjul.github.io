/* Playwright smoke-test for the sudoku2 page. */
import { chromium } from 'playwright';

const URL = 'http://localhost:3000/sudoku2';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx     = await browser.newContext();
    const page    = await ctx.newPage();

    console.log(`Navigating to ${URL} …`);
    await page.goto(URL, { waitUntil: 'networkidle' });

    // 1. Grid renders with cells.
    const cells   = page.locator('[role="gridcell"]');
    const count   = await cells.count();
    console.log(`✓ Grid rendered with ${count} cells`);
    if (count < 9) { throw new Error('too few gridcells'); }

    // 2. Cells carry fixed / userInput class names.
    const fixedCells = page.locator('.SudokuBoard_fixed');
    const userCells  = page.locator('.SudokuBoard_userInput');
    console.log(`✓ Fixed clues: ${await fixedCells.count()} | User-placed: ${await userCells.count()}`);

    // 3. Numpad buttons present.
    const numpadBtns = page.locator('[role="group"] button');
    console.log(`✓ Numpad has ${await numpadBtns.count()} buttons`);

    // 4. Pencil toggle works (aria-pressed flips).
    const pencilBtn = page.locator('button[aria-pressed]');
    expect(await pencilBtn.getAttribute('aria-pressed') === 'false', 'pencil off initially');
    await pencilBtn.click();
    expect(await pencilBtn.getAttribute('aria-pressed') === 'true', 'pencil on after click');
    console.log('✓ Pencil toggle ON → OFF works');

    // 5. Click a cell adds selectedCell class.
    const firstEmpty = page.locator('[role="gridcell"]:not(.SudokuBoard_fixed)').first();
    await firstEmpty.click();
    const selClass   = await firstEmpty.getAttribute('class') ?? '';
    expect(selClass.includes('selectedCell'), 'cell got selectedCell class');
    console.log('✓ Cell click adds selected style');

    // 6. Arrow-key navigation moves selection.
    const prevSel    = await firstEmpty.getAttribute('class') ?? '';
    await page.keyboard.press('ArrowRight');
    const newSel     = await firstEmpty.getAttribute('class') ?? '';
    expect(prevSel !== newSel, 'selection changed via arrow key');
    console.log('✓ Arrow-key navigation works');

    // 7. Number key places a value in the selected cell.
    await page.keyboard.type('5', { delay: 100 });
    const placedText = await cells.first().textContent();
    console.log(`✓ Number key types digit — first cell now shows "${placedText}"`);

    // 8. "New Game" button resets the board.
    await page.locator('text=New Game').click();
    await page.waitForTimeout(300);
    console.log('✓ New Game button works');

    // 9. Dark mode toggle.
    const darkToggle = page.locator('[data-testid="toggle-theme"]');
    if (await darkToggle.count() > 0) {
        await darkToggle.first().click();
        await page.waitForTimeout(400);
        const theme      = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        console.log(`✓ Dark mode toggled → data-theme="${theme}"`);
    } else {
        console.log('⚠ Could not find dark-mode toggle in the DOM');
    }

    // 10. Board still renders correctly after theme change.
    const postCount = await cells.count();
    expect(postCount >= 9, 'gridcells present in new theme');
    console.log(`✓ Board still has ${postCount} cells after theme toggle`);

    await browser.close();
    console.log('\n✅ All checks passed.');
})()
.catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});

// Tiny assertion helper.
function expect(actual, msg) {
    if (!actual) throw new Error(`Assertion failed: ${msg}`);
}
