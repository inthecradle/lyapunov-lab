import { test, expect, type Page } from "@playwright/test";

async function setRange(page: Page, name: string, value: number) {
  const slider = page.getByRole("slider", { name, exact: true });
  await slider.fill(String(value));
}

test("static app loads without browser errors or horizontal overflow", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "なぜ、TCZへ収束するのか。" }),
  ).toBeVisible();
  await expect(page.getByTestId("state-space")).toBeVisible();
  await expect(page.getByTestId("potential-surface")).toHaveAttribute(
    "data-shape",
    "plane-with-well",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("initial.png"),
    fullPage: true,
  });
  await page
    .getByTestId("state-space")
    .screenshot({ path: testInfo.outputPath("bowl-initial.png") });
  expect(errors).toEqual([]);
});

test("scrubbing synchronizes point, potential, residual and cursor; parameter edit resets time", async ({
  page,
}) => {
  await page.goto("./");
  const initialX = Number(
    await page.getByTestId("state-point").getAttribute("data-x"),
  );
  await setRange(page, "時間", 4);
  await expect(page.getByTestId("time-output")).toContainText("4.00");
  const x = Number(
    await page.getByTestId("state-point").getAttribute("data-x"),
  );
  const y = Number(
    await page.getByTestId("state-point").getAttribute("data-y"),
  );
  expect(x).not.toBe(initialX);
  const potential = x * x + 1.5 * y * y;
  expect(
    Number(await page.getByTestId("potential-value").textContent()),
  ).toBeCloseTo(potential, 2);
  expect(
    Number(await page.getByTestId("graph-value").textContent()),
  ).toBeCloseTo(potential - 1, 2);
  await expect(page.getByTestId("graph-cursor")).toHaveAttribute(
    "data-time",
    "4",
  );
  await setRange(page, "TCZの閾値", 2);
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  await expect(page.getByTestId("state-point")).toHaveAttribute(
    "data-x",
    "2.35",
  );
  const v0 = 2.35 ** 2 + 1.5 * 1.25 ** 2;
  expect(
    Number(await page.getByTestId("graph-value").textContent()),
  ).toBeCloseTo(v0 - 2, 2);
});

test("formula and geometry select the same concept; point keyboard editing resets trajectory", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator('[data-math-token="theta"]').click();
  await expect(page.locator('[data-math-token="theta"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: "TCZ領域 Ωθ を選択", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".interaction-note")).toContainText("Ωθ");
  await setRange(page, "時間", 2);
  const point = page.getByTestId("state-point");
  const oldX = Number(await point.getAttribute("data-x"));
  await point.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  expect(Number(await point.getAttribute("data-x"))).toBeCloseTo(oldX + 0.1, 6);
  await expect(page.locator('[data-math-token="V"]')).toHaveCount(1);
  await page
    .getByRole("button", { name: "Lyapunov関数 V の等高線を選択" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-math-token="V"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("inside starts keep a negative signed residual with zero external remainder", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "上限と一致させる", exact: true })
    .click();
  await page.getByText("初期状態と軌道を調整", { exact: false }).click();
  await setRange(page, "初期状態 x₁", 0.2);
  await setRange(page, "初期状態 x₂", 0.2);
  await setRange(page, "時間", 7);
  await expect(page.getByTestId("graph-value")).toHaveText("-0.900");
  expect(
    Number(await page.getByTestId("state-point").getAttribute("data-height")),
  ).toBeCloseTo(0.1, 8);
  await expect(page.getByTestId("derivative")).toHaveText("0.000");
  await expect(
    page.getByRole("button", { name: "保証される上限" }),
  ).toBeDisabled();
  await expect(page.locator(".residual-card strong")).toHaveText("0.000");
});

test("play/pause and proof replay remain controllable", async ({ page }) => {
  await page.goto("./");
  await page.clock.install();
  await page
    .getByRole("button", { name: "シミュレーションを再生", exact: true })
    .click();
  await page.clock.runFor(1100);
  expect(
    Number(
      (await page.getByTestId("time-output").textContent())?.split("/")[0],
    ),
  ).toBeGreaterThan(0.9);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  const paused = await page.getByTestId("time-output").textContent();
  await page.clock.runFor(1000);
  await expect(page.getByTestId("time-output")).toHaveText(paused!);
  await page.getByRole("button", { name: "▶ 証明を再生", exact: true }).click();
  await page.clock.runFor(15000);
  await expect(page.getByTestId("proof-status")).toContainText(
    "TCZへの到達と領域内の漂遊を確認しました",
  );
  await expect(page.getByTestId("time-output")).toContainText("12.00");
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  await expect(
    page.locator('.step-navigation [aria-current="step"]'),
  ).toContainText("状態空間");
});

test("quiz explains asymptotic approach without claiming finite arrival", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "上限と一致させる", exact: true })
    .click();
  await page
    .getByRole("button", { name: "有限時間で中に入る", exact: true })
    .click();
  await expect(page.locator(".quiz-feedback")).toContainText(
    "どの有限時刻でも正",
  );
  await page
    .getByRole("button", {
      name: "近づき続けても、外側にいられる",
      exact: true,
    })
    .click();
  await expect(page.locator(".quiz-feedback")).toContainText("そのとおりです");
});

test("curve targets select formula tokens and V view selects V", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "比較上限の曲線を選択", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-math-token="comparison"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "接線を選択", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-math-token="derivative"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "高さ V", exact: true }).click();
  await page.getByRole("button", { name: "実際のV(t)", exact: true }).click();
  await expect(page.locator('[data-math-token="V"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("proof resumes from scrubbed time and parameter changes restart its steps", async ({
  page,
}) => {
  await page.goto("./");
  await page.clock.install();
  await page.getByRole("button", { name: "証明", exact: true }).click();
  await setRange(page, "時間", 6);
  await page.getByRole("button", { name: "▶ 証明を再生", exact: true }).click();
  await page.clock.runFor(400);
  const value = Number(
    (await page.getByTestId("time-output").textContent())?.split("/")[0],
  );
  expect(value).toBeGreaterThan(6);
  expect(value).toBeLessThan(7);
  await page.locator('[data-math-token="theta"]').click();
  await page.clock.runFor(200);
  await expect(page.locator('[data-math-token="theta"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await setRange(page, "減少率の保証", 1);
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  await expect(
    page.locator('.step-navigation [aria-current="step"]'),
  ).toContainText("状態空間");
});

test("dragging a state point changes the initial condition and resets the clock", async ({
  page,
}) => {
  await page.goto("./");
  await setRange(page, "時間", 2);
  const point = page.getByTestId("state-point");
  await point.scrollIntoViewIfNeeded();
  const oldX = Number(await point.getAttribute("data-x"));
  const box = await point.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 25,
    box!.y + box!.height / 2 + 10,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  expect(Number(await point.getAttribute("data-x"))).toBeGreaterThan(oldX);
});

test("3D surface height follows V and decreases toward the threshold", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "上限と一致させる", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "3D 地形", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const point = page.getByTestId("state-point");
  const height0 = Number(await point.getAttribute("data-height"));
  expect(height0).toBeCloseTo(2.35 ** 2 + 1.5 * 1.25 ** 2, 8);
  await setRange(page, "時間", 4);
  const height4 = Number(await point.getAttribute("data-height"));
  expect(height4).toBeLessThan(height0);
  expect(height4).toBeGreaterThan(1);
  const x = Number(await point.getAttribute("data-x"));
  const y = Number(await point.getAttribute("data-y"));
  expect(height4).toBeCloseTo(x * x + 1.5 * y * y, 8);
  await page
    .getByTestId("state-space")
    .screenshot({ path: testInfo.outputPath("bowl-at-t4.png") });
  await setRange(page, "時間", 12);
  const height12 = Number(await point.getAttribute("data-height"));
  expect(height12).toBeLessThan(height4);
  expect(height12).toBeGreaterThan(1);
});

test("switching 3D and 2D preserves simulation state and editing", async ({
  page,
}) => {
  await page.goto("./");
  await setRange(page, "時間", 4);
  const point = page.getByTestId("state-point");
  const x = await point.getAttribute("data-x");
  const y = await point.getAttribute("data-y");
  await page.getByRole("button", { name: "2D 等高線", exact: true }).click();
  await expect(point).toHaveAttribute("data-x", x!);
  await expect(point).toHaveAttribute("data-y", y!);
  await expect(page.getByTestId("time-output")).toContainText("4.00");
  await point.focus();
  await page.keyboard.press("ArrowRight");
  const newX = await point.getAttribute("data-x");
  await page.getByRole("button", { name: "3D 地形", exact: true }).click();
  await expect(point).toHaveAttribute("data-x", newX!);
  await expect(page.getByTestId("time-output")).toContainText("0.00");
});

test("camera controls keep the surface in view without changing the model", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  const point = page.getByTestId("state-point");
  const x = await point.getAttribute("data-x");
  const height = await point.getAttribute("data-height");
  for (const [rotation, elevation] of [
    [-80, 22],
    [80, 65],
  ]) {
    await setRange(page, "3D視点の回転", rotation);
    await setRange(page, "3D視点の仰角", elevation);
    await expect(point).toHaveAttribute("data-x", x!);
    await expect(point).toHaveAttribute("data-height", height!);
    const inside = await point.evaluate((el) => {
      const circle = el as unknown as SVGCircleElement;
      const x = circle.cx.baseVal.value,
        y = circle.cy.baseVal.value;
      return x > 12 && x < 588 && y > 35 && y < 401;
    });
    expect(inside).toBe(true);
    const surfaceInside = await page
      .getByTestId("potential-surface")
      .evaluate((el) => {
        const bounds = (el as unknown as SVGGraphicsElement).getBBox();
        return (
          bounds.x >= 12 &&
          bounds.x + bounds.width <= 588 &&
          bounds.y >= 35 &&
          bounds.y + bounds.height <= 401
        );
      });
    expect(surfaceInside).toBe(true);
  }
  await page
    .getByTestId("state-space")
    .screenshot({ path: testInfo.outputPath("bowl-camera-extreme.png") });
});
