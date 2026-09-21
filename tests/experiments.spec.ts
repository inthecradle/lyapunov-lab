import { test, expect, type Page } from "@playwright/test";

const scrub = (page: Page, time: number) =>
  page.getByRole("slider", { name: "時間", exact: true }).fill(String(time));
const height = async (page: Page) =>
  Number(await page.getByTestId("state-point").getAttribute("data-height"));
const choose = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();

async function finishProof(page: Page) {
  const next = page.getByRole("button", {
    name: "次の証明ステップ",
    exact: true,
  });
  for (
    let remaining = 5;
    remaining > 0 && (await next.isEnabled());
    remaining--
  ) {
    await next.click();
  }
  await expect(next).toBeDisabled();
  await expect(page.locator(".proof-counter")).toHaveText("06 / 06");
}

test("weakened decrease loses the selected exponential guarantee but still converges", async ({
  page,
}) => {
  await page.goto("./");
  await choose(page, "条件を壊す");
  await expect(page.locator(".guarantee-grid")).toContainText(
    "保証なし・参考線",
  );
  await expect(page.locator(".guarantee-grid")).toContainText("0へ収束");
  await expect(
    page.getByRole("button", { name: "参考曲線（保証なし）", exact: true }),
  ).toBeEnabled();
  const v0 = await height(page);
  await scrub(page, 4);
  const v4 = await height(page);
  expect(v4).toBeLessThan(v0);
  expect(v4 - 1).toBeGreaterThan((v0 - 1) * Math.exp(-0.7 * 4));
  await finishProof(page);
  await expect(page.getByTestId("proof-status")).toHaveText(
    "このαによる指数上限の保証は不成立です",
  );
  await expect(page.locator(".invalid-step")).toHaveCount(2);
  await choose(page, "比較評価");
  await expect(page.getByTestId("time-output")).toContainText("0.00");
  await expect(page.locator(".proof-counter")).toHaveText("01 / 06");
  await expect(
    page.getByRole("button", { name: "保証される上限", exact: true }),
  ).toBeEnabled();
});

test("turning off decrease preserves height while the state keeps moving", async ({
  page,
}) => {
  await page.goto("./");
  await choose(page, "条件を壊す");
  await choose(page, "減少を止める");
  const v0 = await height(page);
  const x0 = await page.getByTestId("state-point").getAttribute("data-x");
  await scrub(page, 7);
  expect(await height(page)).toBeCloseTo(v0, 8);
  expect(await page.getByTestId("state-point").getAttribute("data-x")).not.toBe(
    x0,
  );
  await expect(page.locator(".guarantee-grid")).toContainText(
    "0への収束は保証なし",
  );
  await expect(page.getByTestId("derivative")).toHaveText("0.000");
});

test("invariance preserves the threshold for outward motion starting inside", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await choose(page, "前方不変性");
  await expect(
    page.getByRole("button", { name: "外側へ向ける", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "内側から", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await height(page)).toBeCloseTo(0.49, 8);
  await scrub(page, 4);
  expect(await height(page)).toBeGreaterThan(0.49);
  expect(await height(page)).toBeLessThan(1);
  await choose(page, "境界から");
  await expect(page.getByTestId("boundary-vectors")).toHaveAttribute(
    "data-direction",
    "tangent",
  );
  await scrub(page, 4);
  expect(await height(page)).toBeCloseTo(1, 8);
  await choose(page, "内側へ向ける");
  await expect(page.getByTestId("boundary-vectors")).toHaveAttribute(
    "data-direction",
    "inward",
  );
  await scrub(page, 4);
  expect(await height(page)).toBeLessThan(1);
  await choose(page, "外側へ向ける");
  await choose(page, "内側から");
  expect(await height(page)).toBeLessThan(1);
  await expect(page.getByTestId("boundary-vectors")).toHaveAttribute(
    "data-direction",
    "tangent",
  );
  let previous = await height(page);
  for (const time of [1, 4, 8, 12]) {
    await scrub(page, time);
    const current = await height(page);
    expect(current).toBeGreaterThan(previous);
    expect(current).toBeLessThanOrEqual(1);
    previous = current;
  }
  await expect(page.locator(".guarantee-grid")).toContainText("内側から出ない");
  await expect(page.locator(".scenario-panel")).toContainText(
    "境界では0になります",
  );
  expect(
    Number(await page.getByTestId("graph-value").textContent()),
  ).toBeCloseTo((await height(page)) - 1, 3);
  await finishProof(page);
  await expect(page.getByTestId("proof-status")).toContainText(
    "TCZの前方不変性を確認しました",
  );
  await page.screenshot({
    path: testInfo.outputPath("contained-outward.png"),
    fullPage: true,
  });
  await choose(page, "2D 等高線");
  await expect(page.getByTestId("boundary-vectors")).toHaveAttribute(
    "data-direction",
    "tangent",
  );
  expect(
    Number(await page.getByTestId("potential-value").textContent()),
  ).toBeLessThanOrEqual(1);
  await choose(page, "3D 地形");
  await choose(page, "境界から");
  await scrub(page, 12);
  expect(await height(page)).toBeCloseTo(1, 8);
  await expect(
    page.getByRole("button", { name: "外側から", exact: true }),
  ).toHaveCount(0);
});

test("condition-breaking outward field still loses invariance", async ({
  page,
}) => {
  await page.goto("./");
  await choose(page, "条件を壊す");
  await choose(page, "外向きにする");
  await expect(page.locator(".guarantee-grid")).toContainText("成立しない");
  await expect(page.getByTestId("boundary-vectors")).toHaveAttribute(
    "data-direction",
    "outward",
  );
  await scrub(page, 12);
  expect(await height(page)).toBeGreaterThan(1.5);
});

test("returning from any theme to comparison restores its outside initial point", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByText("初期状態と軌道を調整", { exact: false }).click();
  await page.getByRole("slider", { name: "TCZの閾値", exact: true }).fill("3");
  await page
    .getByRole("slider", { name: "地形の縦方向の重み", exact: true })
    .fill("0.5");
  for (const theme of ["条件を壊す", "前方不変性"]) {
    await choose(page, theme);
    await page
      .getByRole("slider", { name: "初期状態 x₁", exact: true })
      .fill("0");
    await page
      .getByRole("slider", { name: "初期状態 x₂", exact: true })
      .fill("0");
    await scrub(page, 4);
    await choose(page, "比較評価");
    await expect(page.getByTestId("time-output")).toContainText("0.00");
    await expect(page.getByTestId("state-point")).toHaveAttribute(
      "data-x",
      "2.35",
    );
    await expect(page.getByTestId("state-point")).toHaveAttribute(
      "data-y",
      "1.25",
    );
    await expect(
      page.getByRole("button", { name: "外側から始める", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "保証される上限", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("slider", { name: "TCZの閾値", exact: true }),
    ).toHaveValue("3");
    const initialHeight = await height(page);
    expect(initialHeight).toBeGreaterThan(3);
    await scrub(page, 4);
    expect(await height(page)).toBeLessThan(initialHeight);
  }
});

test("invariance constrains initial edits and parameter changes without restricting other themes", async ({
  page,
}) => {
  await page.goto("./");
  await choose(page, "条件を壊す");
  await choose(page, "外向きにする");
  await choose(page, "前方不変性");
  await choose(page, "外側へ向ける");
  await page.getByText("初期状態と軌道を調整", { exact: false }).click();
  await page
    .getByRole("slider", { name: "初期状態 x₂", exact: true })
    .fill("3");
  await page
    .getByRole("slider", { name: "TCZの閾値", exact: true })
    .fill("0.25");
  await page
    .getByRole("slider", { name: "地形の縦方向の重み", exact: true })
    .fill("2");
  expect(await height(page)).toBeLessThanOrEqual(0.25 + 1e-12);
  await page.getByTestId("state-point").focus();
  await page.keyboard.press("ArrowUp");
  await scrub(page, 12);
  expect(await height(page)).toBeLessThanOrEqual(0.25 + 1e-12);
  await expect(page.locator(".guarantee-grid")).toContainText("内側から出ない");
  await choose(page, "比較評価");
  expect(await height(page)).toBeGreaterThan(0.25);
});

test("display modes explain their effect and parameters precede the proof", async ({
  page,
}) => {
  await page.goto("./");
  await choose(page, "直感");
  await expect(page.locator("#display-mode-help")).toContainText(
    "図と文章を中心",
  );
  await expect(page.locator(".formula-strip")).toHaveCount(0);
  await expect(page.locator(".proof-formula")).toHaveCount(0);
  await choose(page, "数式");
  await expect(page.locator(".formula-strip")).toBeVisible();
  await expect(page.locator(".proof-formula")).toBeVisible();
  await choose(page, "証明");
  await scrub(page, 6);
  await expect(page.locator(".proof-counter")).toHaveText("01 / 06");
  await choose(page, "次の証明ステップ");
  await expect(page.locator(".proof-counter")).toHaveText("02 / 06");
  await expect(page.getByTestId("time-output")).toContainText("2.00");
  expect(
    await page
      .locator(".parameters")
      .evaluate((el) =>
        Boolean(
          el.compareDocumentPosition(document.querySelector(".proof-panel")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  const parameters = await page.locator(".parameters").boundingBox();
  const proof = await page.locator(".proof-panel").boundingBox();
  expect(parameters!.y + parameters!.height).toBeLessThan(proof!.y);
});

test("default trajectory enters TCZ then drifts with rising and falling height inside", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "TCZに入って漂う", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const entry = Number(
    await page.getByTestId("entry-marker").getAttribute("data-time"),
  );
  expect(entry).toBeGreaterThan(0);
  expect(entry).toBeLessThan(4);
  await scrub(page, Number((entry - 0.03).toFixed(2)));
  expect(await height(page)).toBeGreaterThan(1);
  await scrub(page, Number((entry + 0.03).toFixed(2)));
  expect(await height(page)).toBeLessThan(1);
  let rises = false,
    falls = false;
  for (const t of [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12]) {
    await scrub(page, t);
    const v = await height(page);
    expect(v).toBeLessThan(1);
    const slope = Number(await page.getByTestId("derivative").textContent());
    rises ||= slope > 0.01;
    falls ||= slope < -0.01;
    expect(
      Number(await page.getByTestId("graph-value").textContent()),
    ).toBeCloseTo(v - 1, 2);
    await expect(page.locator(".residual-card strong")).toHaveText("0.000");
  }
  expect(rises).toBe(true);
  expect(falls).toBe(true);
  await expect(page.getByTestId("velocity-vector")).toBeVisible();
  await expect(page.getByTestId("interior-trajectory")).toBeVisible();
  await expect(page.locator(".scenario-panel")).toContainText(
    "元の数式から内部軌道が決まるという意味ではありません",
  );
  await page.screenshot({
    path: testInfo.outputPath("drifting-inside.png"),
    fullPage: true,
  });
  await choose(page, "2D 等高線");
  await expect(page.getByTestId("velocity-vector")).toBeVisible();
  await expect(page.getByTestId("interior-trajectory")).toBeVisible();
  await choose(page, "θ以下ならTCZ内に留まっている");
  await expect(page.locator(".quiz-feedback")).toContainText("そのとおりです");
  await choose(page, "上限と一致させる");
  await scrub(page, 12);
  expect(
    Number(await page.getByTestId("potential-value").textContent()),
  ).toBeGreaterThan(1);
  await choose(page, "TCZに入って漂う");
  await expect(page.getByTestId("time-output")).toContainText("0.00");
});
