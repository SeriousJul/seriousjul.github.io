/* E2E regression check for issue #39 - the runtime bugs behind the five
   "npm run typecheck" errors in src/components/SudokuGameV2/SudokuGameV2.tsx.
     A  adding a pencil mark called .sort() on the number that push() returns
     B  an accepted placement deep-copied the board instead of the pencil grid,
        so it threw "number is not iterable" and unmounted the board
     C  an accepted placement must wipe that digit from the marks of its row,
        column and box, which is what the line above was meant to do
     D  a click selects a cell in pencil mode too (the precedence bug)
     E  a rejected placement still costs a mistake
     F  solving a whole game, which runs the clearing branch on every placement
   Each case loads a fresh page, so one crash cannot hide the next one.

   The generator does not guarantee a unique puzzle, so this script never trusts
   its own solver for "is this digit the answer". It reads the game's verdict
   from the UI: an accepted placement leaves the mistake counter alone, a
   rejected one increments it.

   Usage:  npm start &   then   node tests/sudoku2-runtime-verify.mjs [url]
   Needs a Playwright install, same as tests/sudoku2-verify.mjs. Set CHROME_PATH
   to use a system Chromium instead of the browser Playwright downloaded. */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:3000/sudoku2';
const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

async function openPage() {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    page.on('console', m => {
        const t = m.text();
        if (m.type() === 'error' && !/React DevTools|favicon/i.test(t)) errors.push(t.replace(/\s+/g, ' ').slice(0, 140));
    });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[role="gridcell"]').first().waitFor({ timeout: 20000 });
    if ((await page.locator('[role="gridcell"]').count()) !== 81) throw new Error('board did not mount');
    return { page, errors };
}

const gridOf = page => page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].map(el => {
        const clue = el.querySelector('[class*="fixedDigit"]');
        const user = el.querySelector('[class*="userDigit"]');
        if (clue) return { v: Number(clue.textContent), clue: true };
        if (user) return { v: Number(user.textContent), clue: false };
        return { v: 0, clue: false, marks: [...el.querySelectorAll('[class*="pencilDigit"]')]
            .map(s => s.textContent.trim()).filter(Boolean).map(Number) };
    }));
const marksAt = async (page, i) => ((await gridOf(page))[i]?.marks ?? []);
const valueAt = async (page, i) => ((await gridOf(page))[i]?.v ?? 0);
const mounted = page => page.locator('[role="gridcell"]').count();
const mistakesOf = page => page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find(p => /Mistakes:/.test(p.textContent));
    return el ? Number(el.textContent.replace(/\D+/g, '')) : -1;
});
const selectedOf = page => page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].findIndex(e => /selectedCell/.test(e.className)));
const cell = (page, i) => page.locator(`[role="gridcell"]:nth-child(${i + 1})`);

async function setPencilMode(page, want) {
    const btn = page.locator('button[aria-pressed]');
    if ((await btn.getAttribute('aria-pressed')) !== String(want)) await btn.click();
    await page.waitForTimeout(100);
}

// Press digits into an empty cell until the game accepts one; an accepted
// placement leaves the mistake counter untouched. The cell ends up cleared.
async function findAcceptedDigit(page, target, errors) {
    for (let d = 1; d <= 9; d++) {
        const mistakes = await mistakesOf(page);
        await cell(page, target).click();
        await page.keyboard.press(String(d));
        await page.waitForTimeout(250);
        if ((await mounted(page)) !== 81) {
            throw new Error(`board unmounted after the game accepted ${d}: ` + errors.slice(-1).join(' | '));
        }
        if ((await mistakesOf(page)) === mistakes) return d;
        await page.keyboard.press('Backspace');       // clear the rejected guess
        await page.waitForTimeout(150);
    }
    return null;
}

const emptyCells = async page =>
    (await gridOf(page)).map((c, i) => (!c.clue && c.v === 0 ? i : -1)).filter(i => i >= 0);

// ---------------------------------------------------------------------------
// A - pencil marks (line 179). Adding a mark must not throw, and every mark
//     must stay visible in its own slot.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const target = (await emptyCells(page))[0];
    await setPencilMode(page, true);
    const before = errors.length;
    await cell(page, target).click();
    for (const d of ['3', '1', '2']) await page.keyboard.press(d);
    await page.waitForTimeout(300);
    check('A1 adding pencil marks throws nothing', errors.length === before, errors.slice(before).join(' | '));
    check('A2 all three marks render', JSON.stringify(await marksAt(page, target)) === '[1,2,3]',
        JSON.stringify(await marksAt(page, target)));
    check('A3 board still mounted after pencil input', (await mounted(page)) === 81, String(await mounted(page)));
    const b2 = errors.length;
    await page.keyboard.press('2');                   // toggle one mark back off
    await page.waitForTimeout(250);
    check('A4 removing one mark works',
        errors.length === b2 && JSON.stringify(await marksAt(page, target)) === '[1,3]',
        errors.slice(b2).join(' | ') + ' marks=' + JSON.stringify(await marksAt(page, target)));
    await page.close();
} catch (e) { check('A pencil marks', false, e.message.split('\n')[0]); }

// ---------------------------------------------------------------------------
// B - accepted placement. Placing the right digit runs the pencil clearing
//     branch, which used to copy the board and throw.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const target = (await emptyCells(page))[0];
    const before = errors.length;
    const digit = await findAcceptedDigit(page, target, errors);
    check('B1 accepted placement throws nothing',
        digit !== null && errors.length === before, `digit=${digit} ` + errors.slice(before).join(' | '));
    check('B2 board still mounted after an accepted placement', (await mounted(page)) === 81,
        String(await mounted(page)));
    check('B3 accepted digit shown in the cell', digit !== null && (await valueAt(page, target)) === digit,
        `cell=${await valueAt(page, target)} digit=${digit}`);
    await page.close();
} catch (e) { check('B accepted placement', false, e.message.split('\n')[0]); }

// ---------------------------------------------------------------------------
// C - an accepted placement wipes the same digit from the pencil marks of its
//     row, column and box, which is what the clearing branch exists to do.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const grid = await gridOf(page);
    const empties = grid.map((c, i) => (!c.clue && c.v === 0 ? i : -1)).filter(i => i >= 0);
    const target = empties[0];
    const answer = await findAcceptedDigit(page, target, errors);
    if (answer === null) throw new Error('no digit accepted for the target cell');
    await page.keyboard.press('Backspace');           // put the target back to empty
    await page.waitForTimeout(200);

    const tr = Math.floor(target / 9), tc = target % 9;
    const unit = [];
    for (let k = 0; k < 9; k++) {
        if (k !== tc) unit.push(tr * 9 + k);
        if (k !== tr) unit.push(k * 9 + tc);
    }
    const r0 = Math.floor(tr / 3) * 3, c0 = Math.floor(tc / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
            const idx = (r0 + i) * 9 + (c0 + j);
            if (idx !== target && !unit.includes(idx)) unit.push(idx);
        }
    const marked = unit.filter(i => !grid[i].clue && grid[i].v === 0).slice(0, 3);
    if (!marked.length) throw new Error('no empty unit peer to mark');

    await setPencilMode(page, true);
    for (const idx of marked) {
        await cell(page, idx).click();
        await page.keyboard.press(String(answer));
    }
    await page.waitForTimeout(250);
    const before = await Promise.all(marked.map(i => marksAt(page, i)));
    check('C1 marks present on unit peers before the placement',
        before.length === marked.length && before.every(m => m.includes(answer)), JSON.stringify(before));

    const errCount = errors.length;
    await setPencilMode(page, false);
    await cell(page, target).click();
    await page.keyboard.press(String(answer));
    await page.waitForTimeout(400);
    check('C2 clearing unit marks throws nothing', errors.length === errCount, errors.slice(errCount).join(' | '));
    const after = await Promise.all(marked.map(i => marksAt(page, i)));
    check('C3 unit marks cleared', after.every(m => !m.includes(answer)), JSON.stringify(after));
    check('C4 board still mounted', (await mounted(page)) === 81, String(await mounted(page)));
    await page.close();
} catch (e) { check('C unit mark clearing', false, e.message.split('\n')[0]); }

// ---------------------------------------------------------------------------
// D - selection follows the click in either mode, and adding a mark after a
//     click keeps that selection.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const [t1, t2] = await emptyCells(page);
    await cell(page, t1).click();
    await setPencilMode(page, true);
    await cell(page, t2).click();
    check('D1 selection follows a click in pencil mode', (await selectedOf(page)) === t2,
        `selected=${await selectedOf(page)} expected=${t2}`);
    const before = errors.length;
    await page.keyboard.press('5');
    await page.waitForTimeout(300);
    check('D2 adding a mark after a click throws nothing', errors.length === before, errors.slice(before).join(' | '));
    check('D3 selection unchanged after adding a mark', (await selectedOf(page)) === t2);
    // Arrow navigation keeps working in pencil mode too.
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const moved = await selectedOf(page);
    check('D4 arrow key moves the selection in pencil mode', moved !== t2 && moved >= 0, `selected=${moved}`);
    await page.close();
} catch (e) { check('D selection in pencil mode', false, e.message.split('\n')[0]); }

// ---------------------------------------------------------------------------
// E - a rejected placement still costs a mistake, and a wrong digit stays put
//     without breaking the board.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const target = (await emptyCells(page))[0];
    const before = errors.length;
    let rejected = false;
    for (let d = 1; d <= 9; d++) {
        const mistakes = await mistakesOf(page);
        await cell(page, target).click();
        await page.keyboard.press(String(d));
        await page.waitForTimeout(250);
        if ((await mistakesOf(page)) > mistakes) { rejected = true; break; }
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(150);
    }
    check('E1 rejected placement counted as a mistake', rejected);
    check('E2 rejected placement throws nothing', errors.length === before, errors.slice(before).join(' | '));
    check('E3 board still mounted', (await mounted(page)) === 81, String(await mounted(page)));
    await page.close();
} catch (e) { check('E rejected placement', false, e.message.split('\n')[0]); }

// ---------------------------------------------------------------------------
// F - solve the whole puzzle. This runs the clearing branch on every accepted
//     placement, so it is the broadest check of the three fixes.
// ---------------------------------------------------------------------------
try {
    const { page, errors } = await openPage();
    const before = errors.length;
    let placed = 0;
    for (let step = 0; step < 81; step++) {
        const grid = await gridOf(page);
        const target = grid.findIndex(c => !c.clue && c.v === 0);
        if (target === -1) break;
        if ((await mounted(page)) !== 81) throw new Error(`board unmounted after ${placed} placements`);
        let accepted = false;
        for (let d = 1; d <= 9 && !accepted; d++) {
            const mistakes = await mistakesOf(page);
            await cell(page, target).click();
            await page.keyboard.press(String(d));
            await page.waitForTimeout(120);
            if ((await mounted(page)) !== 81) {
                throw new Error(`board unmounted after ${placed} placements, on cell ${target} with ${d}: `
                    + errors.slice(-1).join(' | '));
            }
            if ((await mistakesOf(page)) === mistakes) accepted = true;
            else { await page.keyboard.press('Backspace'); await page.waitForTimeout(80); }
        }
        if (!accepted) throw new Error(`no digit accepted for cell ${target}`);
        placed++;
    }
    check('F1 full solve placed every empty cell', placed >= 30, `placed=${placed}`);
    check('F2 full solve threw nothing', errors.length === before, errors.slice(before).join(' | '));
    check('F3 win banner shown', await page.locator('text=You solved it!').isVisible(),
        `mistakes=${await mistakesOf(page)}`);
    await page.close();
} catch (e) { check('F full solve', false, e.message.split('\n')[0]); }

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
