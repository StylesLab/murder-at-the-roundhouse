const { test, expect } = require('@playwright/test');

async function clickFirstAvailable(page, labels) {
  for (const label of labels) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return label;
    }
  }
  throw new Error(`None of these buttons was visible: ${labels.join(', ')}`);
}

async function completePrivateTurn(page) {
  await page.getByRole('button', { name: /I am .* — reveal my screen/ }).click();

  if (await page.getByRole('heading', { name: /Choose .* to poison/ }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Use no poison/ }).click();
    await page.getByRole('button', { name: 'Continue to swap' }).click();
  } else if (await page.getByRole('heading', { name: 'Choose someone to protect' }).isVisible().catch(() => false)) {
    await page.locator('.person-choice').first().click();
    await page.getByRole('button', { name: 'Continue to swap' }).click();
  }

  if (await page.getByRole('button', { name: /Keep my / }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Keep my / }).click();
    await page.getByRole('button', { name: 'Seal my turn and pass on' }).click();
  } else {
    await page.getByRole('button', { name: 'Hide my screen and pass on' }).click();
  }
}

async function beginDinner(page) {
  await page.goto('/poison/?debug=true');
  await page.getByRole('button', { name: 'Randomise characters' }).click();
  await page.getByRole('button', { name: 'Begin dinner' }).click();

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /I am .* — reveal my screen/ }).click();
    await expect(page.getByRole('heading', { name: /You are the/ })).toBeVisible();
    await page.getByRole('button', { name: 'Hide my role and pass on' }).click();
  }
}

test('plays a complete five-course dinner with one random private pass per active player', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 123456789;
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });

  await beginDinner(page);
  const passOrders = [];

  for (let course = 0; course < 5; course += 1) {
    await page.getByRole('button', { name: 'Begin private turns' }).click();
    const order = [];

    for (let turn = 0; turn < 4; turn += 1) {
      const passHeading = page.getByRole('heading', { name: /Pass the device to/ });
      await expect(passHeading).toBeVisible();
      order.push((await passHeading.textContent()).replace('Pass the device to ', '').trim());
      await completePrivateTurn(page);
    }

    expect(new Set(order).size).toBe(4);
    passOrders.push(order.join('|'));

    await expect(page.getByRole('heading', { name: /reckoning and discussion/ })).toBeVisible();
    await expect(page.locator('.health-board')).toBeVisible();

    if (course < 4) {
      await page.getByRole('button', { name: 'Start the next course' }).click();
    } else {
      await page.getByRole('button', { name: 'Begin accusations' }).click();
    }
  }

  expect(new Set(passOrders).size).toBeGreaterThan(1);

  for (let vote = 0; vote < 4; vote += 1) {
    await page.getByRole('button', { name: /I am .* — reveal my screen/ }).click();
    await page.locator('.person-choice').first().click();
    await page.getByRole('button', { name: 'Seal my accusation' }).click();
  }

  await expect(page.getByRole('heading', { name: /The guests prevail|The Poisoner triumphs|The Poisoner escapes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The dinner, reconstructed' })).toBeVisible();
  await expect(page.locator('.timeline article')).toHaveCount(5);
});

test('bedridden players skip meal actions but still vote', async ({ page }) => {
  await beginDinner(page);

  const bedriddenName = await page.evaluate(() => {
    const player = state.players.find(candidate => candidate.role === 'Guest');
    player.health = 0;
    beginCourse();
    return player.name;
  });

  await expect(page.getByText(/Bedridden players take no further meal actions/)).toBeVisible();
  await page.getByRole('button', { name: 'Begin private turns' }).click();

  const mealTurnNames = [];
  for (let turn = 0; turn < 3; turn += 1) {
    const passHeading = page.getByRole('heading', { name: /Pass the device to/ });
    const name = (await passHeading.textContent()).replace('Pass the device to ', '').trim();
    mealTurnNames.push(name);
    await completePrivateTurn(page);
  }

  expect(mealTurnNames).not.toContain(bedriddenName);
  await expect(page.getByRole('heading', { name: /reckoning and discussion/ })).toBeVisible();
  await expect(page.locator('.health-card', { hasText: bedriddenName })).toContainText('Bedridden');

  await page.evaluate(() => beginAccusations());
  const voters = [];
  for (let vote = 0; vote < 4; vote += 1) {
    const passHeading = page.getByRole('heading', { name: /Pass the device to/ });
    voters.push((await passHeading.textContent()).replace('Pass the device to ', '').trim());
    await page.getByRole('button', { name: /I am .* — reveal my screen/ }).click();
    await page.locator('.person-choice').first().click();
    await page.getByRole('button', { name: 'Seal my accusation' }).click();
  }

  expect(voters).toContain(bedriddenName);
}