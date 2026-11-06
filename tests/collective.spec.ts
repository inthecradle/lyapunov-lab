import { test, expect, type Page } from "@playwright/test";

async function chooseTheorem(page: Page, theorem: 1 | 2 | 3) {
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: new RegExp(`^定理${theorem}：`) })
    .click();
  if (theorem !== 1) {
    await page.getByRole("button", { name: "2D 平面", exact: true }).click();
  }
}

async function seek(page: Page, time: number) {
  await page
    .getByRole("slider", { name: "共有モデルの時間", exact: true })
    .fill(String(time));
}

async function position(page: Page, i: number) {
  const point = page.getByTestId(`collective-point-${i}`);
  return {
    x: Number(await point.getAttribute("data-x")),
    y: Number(await point.getAttribute("data-y")),
  };
}

test("theorems switch with no browser errors or horizontal overflow", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  for (const theorem of [2, 3] as const) {
    await chooseTheorem(page, theorem);
    await expect(page.getByTestId("collective-lab")).toBeVisible();
    await expect(page.locator(".series-theorem")).toHaveText(
      `THEOREM 0${theorem}`,
    );
    await expect(page.getByTestId("collective-time")).toContainText("0.00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`theorem-${theorem}.png`),
      fullPage: true,
    });
  }
  await chooseTheorem(page, 1);
  await expect(page.getByTestId("state-space")).toBeVisible();
  expect(errors).toEqual([]);
});

test("connected agreement decays and seeking backward reproduces the trajectory", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await seek(page, 3);
  const atThree = await position(page, 0);
  await seek(page, 12);
  const first = await position(page, 0);
  const second = await position(page, 1);
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeLessThan(
    0.00001,
  );
  expect(first.x).toBeCloseTo(0.45, 4);
  expect(first.y).toBeCloseTo(0.45, 4);
  await seek(page, 3);
  expect(await position(page, 0)).toEqual(atThree);
  await expect(page.getByTestId("collective-graph-cursor")).toHaveAttribute(
    "data-time",
    "3",
  );
});

test("disconnection leaves intergroup differences even as the residual decreases", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page.getByRole("button", { name: "集団を分断", exact: true }).click();
  await seek(page, 12);
  const first = await position(page, 0);
  const second = await position(page, 1);
  const third = await position(page, 2);
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeLessThan(
    0.001,
  );
  expect(Math.hypot(first.x - third.x, first.y - third.y)).toBeGreaterThan(0.1);
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeLessThan(0.001);
});

test("switching from agreement to abstraction retains initial states and targets the LUB", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page.getByRole("button", { name: "共有へ収束", exact: true }).click();
  const original = await position(page, 0);
  await seek(page, 5);
  await chooseTheorem(page, 3);
  await expect(
    page.getByRole("slider", { name: "LUBへの力", exact: true }),
  ).toHaveValue("0.8");
  await page.getByRole("slider", { name: "LUBへの力", exact: true }).fill("0");
  await page.getByRole("button", { name: "共有へ収束", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "LUBへの力", exact: true }),
  ).toHaveValue("0.8");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  expect(await position(page, 0)).toEqual(original);
  await seek(page, 12);
  for (let i = 0; i < 3; i++) {
    const point = await position(page, i);
    expect(point.x).toBeCloseTo(0.8, 3);
    expect(point.y).toBeCloseTo(0.8, 3);
  }
  await chooseTheorem(page, 2);
  expect(await position(page, 0)).toEqual(original);
  await seek(page, 12);
  expect((await position(page, 0)).x).toBeCloseTo(0.45, 4);
});

test("point keyboard edits reset time and change the initial state", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await seek(page, 2);
  const point = page.getByTestId("collective-point-0");
  await point.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  const edited = await position(page, 0);
  expect(edited.x).toBeCloseTo(0.82, 6);
  expect(edited.y).toBeCloseTo(0.2, 6);
  await chooseTheorem(page, 3);
  expect(await position(page, 0)).toEqual(edited);
  await expect(page.getByTestId("collective-world-0")).toHaveAttribute(
    "data-x",
    String(edited.x),
  );
  await expect(page.getByTestId("collective-lub")).toHaveAttribute(
    "data-x",
    String(edited.x),
  );
});

test("dragging updates the initial state, world and LUB, which stay fixed during playback", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 3);
  const svg = page.locator("svg.cl-state");
  await svg.scrollIntoViewIfNeeded();
  const locations = await svg.evaluate((element) => {
    const matrix = (element as SVGSVGElement).getScreenCTM()!;
    return [
      { x: 0.8, y: 0.2 },
      { x: 0.62, y: 0.32 },
    ].map(({ x, y }) => {
      const p = new DOMPoint(48 + x * 330, 370 - y * 330).matrixTransform(
        matrix,
      );
      return { x: p.x, y: p.y };
    });
  });
  await page.mouse.move(locations[0].x, locations[0].y);
  await page.mouse.down();
  await page.mouse.move(locations[1].x, locations[1].y, { steps: 4 });
  await page.mouse.up();
  const point = await position(page, 0);
  expect(point.x).toBeCloseTo(0.62, 2);
  expect(point.y).toBeCloseTo(0.32, 2);
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  const world = page.getByTestId("collective-world-0");
  const lub = page.getByTestId("collective-lub");
  await expect(world).toHaveAttribute("data-x", String(point.x));
  await expect(world).toHaveAttribute("data-y", String(point.y));
  await expect(page.getByTestId("collective-world-1")).toHaveAttribute(
    "data-x",
    "0.2",
  );
  await expect(page.getByTestId("collective-world-2")).toHaveAttribute(
    "data-x",
    "0.35",
  );
  await expect(lub).toHaveAttribute("data-x", String(point.x));
  await expect(lub).toHaveAttribute("data-y", "0.8");
  await seek(page, 12);
  await expect(world).toHaveAttribute("data-x", String(point.x));
  await expect(world).toHaveAttribute("data-y", String(point.y));
  for (let i = 0; i < 3; i++) {
    const target = await position(page, i);
    expect(target.x).toBeCloseTo(point.x, 3);
    expect(target.y).toBeCloseTo(0.8, 3);
  }
  await page
    .getByRole("spinbutton", { name: "主体1の初期y", exact: true })
    .fill("0.9");
  await expect(world).toHaveAttribute("data-y", "0.9");
  await expect(lub).toHaveAttribute("data-y", "0.9");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
});

test("eta zero reproduces consensus, while a positive eta reaches LUB without coupling", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 3);
  await page.getByRole("slider", { name: "LUBへの力", exact: true }).fill("0");
  await seek(page, 12);
  expect((await position(page, 0)).x).toBeCloseTo(0.45, 4);
  for (const pair of ["12", "13", "23"]) {
    await page
      .getByRole("slider", { name: `結合係数 γ${pair}`, exact: true })
      .fill("0");
  }
  await page.getByRole("slider", { name: "LUBへの力", exact: true }).fill("1");
  await seek(page, 12);
  for (let i = 0; i < 3; i++) {
    const point = await position(page, i);
    expect(point.x).toBeCloseTo(0.8, 4);
    expect(point.y).toBeCloseTo(0.8, 4);
  }
});

test("formula and edge selection agree and numeric editing works when agents overlap", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page.getByTestId("collective-pair-0").click();
  await expect(page.getByTestId("collective-edge-0")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("collective-edge-1").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("collective-pair-1")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await seek(page, 12);
  await page
    .getByRole("spinbutton", { name: "主体1の初期x", exact: true })
    .fill("0.6");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  expect((await position(page, 0)).x).toBeCloseTo(0.6, 5);
});

test("closing playback permits parameter changes and theorem switching", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop popup playback");
  await page.goto("./");
  await chooseTheorem(page, 2);
  const play = page.getByTestId("cl-play");
  await play.click();
  await expect(play).toContainText("一時停止");
  await expect
    .poll(async () =>
      Number.parseFloat(await page.getByTestId("collective-time").innerText()),
    )
    .toBeGreaterThan(0.05);
  await page
    .getByRole("button", { name: "閉じて一時停止", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("0.4");
  await expect(play).toContainText("再生");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  await play.click();
  await page.keyboard.press("Escape");
  await chooseTheorem(page, 3);
  await expect(play).toContainText("再生");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  await expect(
    page.getByRole("slider", { name: "結合係数 γ12", exact: true }),
  ).toHaveValue("0.4");
  await page
    .getByRole("link", { name: /この実験について/ })
    .first()
    .click();
  await expect(page.locator("#about")).toBeInViewport();
});

test("formulas render the individual, social and abstraction terms", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 3);
  const formula = page.locator(".cl-formula");
  await expect(formula.locator("math mo").filter({ hasText: "∑" })).toHaveCount(
    2,
  );
  await expect(formula.locator(".katex-error")).toHaveCount(0);
  expect(
    (await formula.locator(".katex-html").allTextContents()).join(" "),
  ).not.toMatch(/frac|gamma/);
  await expect(page.getByTestId("paper-formula").locator("math")).toBeVisible();
  await expect(
    page.getByTestId("paper-formula").locator(".katex-error"),
  ).toHaveCount(0);
});

test("ordered pair costs use each independent gamma coefficient", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeCloseTo(0.936, 3);
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("0.2");
  for (const pair of ["13", "23"]) {
    await expect(
      page.getByRole("slider", { name: `結合係数 γ${pair}`, exact: true }),
    ).toHaveValue("0.8");
  }
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeCloseTo(0.504, 3);
});

test("threshold membership does not imply zero disagreement or change the trajectory", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await seek(page, 0.1);
  const before = await position(page, 0);
  expect(
    Number(await page.getByTestId("collective-residual").textContent()),
  ).toBeGreaterThan(0);
  await page
    .getByRole("slider", { name: "安定領域の閾値", exact: true })
    .fill("0.5");
  await seek(page, 0.1);
  expect(await position(page, 0)).toEqual(before);
  expect(
    Number(await page.getByTestId("collective-residual").textContent()),
  ).toBe(0);
  expect(
    Number(await page.getByTestId("collective-disagreement").textContent()),
  ).toBeGreaterThan(0.1);
  // A horizontal SVG line has a zero-height bounding box in Playwright.
  const thresholdLine = page.getByTestId("collective-threshold-line");
  await expect(
    page.locator("svg").filter({ has: thresholdLine }),
  ).toBeVisible();
  const geometry = await thresholdLine.evaluate((element) => {
    const line = element as SVGLineElement;
    return {
      width: line.x2.baseVal.value - line.x1.baseVal.value,
      y: line.y1.baseVal.value,
      height: line.ownerSVGElement!.viewBox.baseVal.height,
      stroke: getComputedStyle(line).stroke,
    };
  });
  expect(geometry.width).toBeGreaterThan(0);
  expect(geometry.y).toBeGreaterThan(0);
  expect(geometry.y).toBeLessThan(geometry.height);
  expect(geometry.stroke).not.toBe("none");
});
