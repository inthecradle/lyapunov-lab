import { test, expect, type Page } from "@playwright/test";

async function skipIntroduction(page: Page) {
  const skip = page.getByRole("button", {
    name: "導入をスキップ",
    exact: true,
  });
  if (await skip.count()) await skip.click();
}

async function openTerrain(page: Page, theorem: 2 | 3, skipIntro = true) {
  await page.goto("./");
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: new RegExp(`^定理${theorem}：`) })
    .click();
  await expect(
    page.getByRole("button", { name: "3D 地形", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  if (skipIntro) await skipIntroduction(page);
}

async function seek(page: Page, time: number) {
  await page
    .getByRole("slider", { name: "共有モデルの時間", exact: true })
    .fill(String(time));
}

async function pointValues(page: Page) {
  const point = page.getByTestId("collective-terrain-point");
  return {
    x: Number(await point.getAttribute("data-x")),
    y: Number(await point.getAttribute("data-y")),
    height: Number(await point.getAttribute("data-height")),
  };
}

async function centroidValues(page: Page) {
  const centroid = page.getByTestId("collective-terrain-centroid");
  return {
    x: Number(await centroid.getAttribute("data-x")),
    y: Number(await centroid.getAttribute("data-y")),
  };
}

test("theorem 2 starts with its fixed Q terrain and never morphs individual valleys", async ({
  page,
}) => {
  await openTerrain(page, 2, false);
  const surface = page.getByTestId("collective-terrain-surface");
  const expectFixedTerrain = async () => {
    await expect(surface).toHaveAttribute("data-intro-progress", "1");
    await expect(surface).toHaveAttribute("data-shape", "plane-with-well");
    await expect(page.getByTestId("collective-intro-status")).toHaveCount(0);
    await expect(page.getByTestId("collective-morph-controls")).toHaveCount(0);
    await expect(
      page.getByRole("slider", { name: "モーフィングの進み具合", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "変形を最初から再生", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "導入をスキップ", exact: true }),
    ).toHaveCount(0);
  };
  await expectFixedTerrain();
  const geometry = await surface.innerHTML();
  await seek(page, 2);
  await expectFixedTerrain();
  expect(await surface.innerHTML()).toBe(geometry);
  await seek(page, 0);
  await expectFixedTerrain();
  await page
    .getByRole("button", { name: "時刻を0に戻す", exact: true })
    .click();
  await expectFixedTerrain();
  await page
    .getByRole("spinbutton", { name: "主体1の初期x", exact: true })
    .fill("0.7");
  await expectFixedTerrain();
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("0.4");
  await expectFixedTerrain();
  await page.getByRole("button", { name: "2D 平面", exact: true }).click();
  await page.getByRole("button", { name: "3D 地形", exact: true }).click();
  await expectFixedTerrain();
  for (const theorem of [3, 2]) {
    await page
      .getByRole("navigation", { name: "定理を選ぶ" })
      .getByRole("button", { name: new RegExp(`^定理${theorem}：`) })
      .click();
  }
  await expectFixedTerrain();
});

for (const theorem of [3] as const) {
  test(`theorem ${theorem} introduction merges three valleys before model time and supports pause`, async ({
    page,
  }, testInfo) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await openTerrain(page, theorem, false);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    const surface = page.getByTestId("collective-terrain-surface");
    const status = page.getByTestId("collective-intro-status");
    const replay = page.getByRole("button", {
      name: "変形を最初から再生",
      exact: true,
    });
    await expect(surface).toHaveAttribute("data-shape", "individual-wells");
    await expect(surface).toHaveAttribute("data-intro-progress", "0");
    for (let i = 0; i < 3; i++) {
      await expect(
        page.getByTestId(`collective-intro-valley-${i}`),
      ).toBeVisible();
    }
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`intro-${theorem}-initial.png`),
    });
    const diagramTop = await page
      .getByTestId("collective-terrain-svg")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const initial = await pointValues(page);
    const initialTotal = await page
      .getByTestId("collective-total")
      .textContent();
    await replay.click();
    await page.clock.runFor(1200);
    await expect(surface).toHaveAttribute("data-shape", "merging-wells");
    const progress = Number(await surface.getAttribute("data-intro-progress"));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
    const targetCenter = 0.8;
    const blend = progress * progress * (3 - 2 * progress);
    const valley0 = page.getByTestId("collective-intro-valley-0");
    expect(Number(await valley0.getAttribute("data-x"))).toBeCloseTo(
      0.8 + blend * (targetCenter - 0.8),
      10,
    );
    expect(Number(await valley0.getAttribute("data-y"))).toBeCloseTo(
      0.2 + blend * (targetCenter - 0.2),
      10,
    );
    expect(Number(await valley0.getAttribute("data-radius"))).toBeGreaterThan(
      0.55,
    );
    expect(Number(await valley0.getAttribute("data-depth"))).toBeGreaterThan(
      120,
    );
    await expect(page.getByTestId("collective-time")).toContainText("0.00");
    expect((await pointValues(page)).x).toBe(initial.x);
    expect((await pointValues(page)).y).toBe(initial.y);
    expect(await page.getByTestId("collective-total").textContent()).toBe(
      initialTotal,
    );
    await page
      .getByRole("slider", { name: "モーフィングの進み具合", exact: true })
      .fill(String(Math.round(progress * 100)));
    const pausedProgress = await surface.getAttribute("data-intro-progress");
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`intro-${theorem}-merging.png`),
    });
    await page.clock.runFor(800);
    await expect(surface).toHaveAttribute(
      "data-intro-progress",
      pausedProgress!,
    );
    await expect(page.getByTestId("collective-time")).toContainText("0.00");
    await replay.click();
    await page.clock.runFor(1500);
    expect(
      Number(await surface.getAttribute("data-intro-progress")),
    ).toBeGreaterThan(Number(pausedProgress));
    await page.clock.runFor(550);
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`intro-${theorem}-halfway.png`),
    });
    await page.clock.runFor(3500);
    await expect(surface).toHaveAttribute("data-intro-progress", "1");
    await expect(surface).toHaveAttribute("data-shape", "plane-with-well");
    await expect(status).toHaveCount(0);
    expect(
      await page
        .getByTestId("collective-terrain-svg")
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY),
    ).toBeCloseTo(diagramTop, 1);
    expect(
      Number.parseFloat(await page.getByTestId("collective-time").innerText()),
    ).toBeGreaterThan(0);
    const moving = await pointValues(page);
    const target = 0.8;
    expect(Math.hypot(moving.x - target, moving.y - target)).toBeLessThan(
      Math.hypot(initial.x - target, initial.y - target),
    );
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`intro-${theorem}-complete.png`),
    });
    await seek(page, 12);
    await replay.click();
    await page.clock.runFor(650);
    await expect(surface).toHaveAttribute("data-shape", "merging-wells");
    await expect(page.getByTestId("collective-time")).toContainText("0.00");
  });
}

for (const theorem of [2, 3] as const) {
  test(`theorem ${theorem} uses slow convergence playback and matching graph seconds`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await openTerrain(page, theorem);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    const initialTotal = Number(
      await page.getByTestId("collective-total").textContent(),
    );
    await page.getByTestId("cl-play").click();
    await page.clock.runFor(1016);
    await page.getByTestId("cl-play").click();
    const clock = page.getByTestId("collective-time");
    const modelTime = Number(await clock.getAttribute("data-model-time"));
    const playbackTime = Number(await clock.getAttribute("data-playback-time"));
    expect(modelTime).toBeGreaterThan(0.095);
    expect(modelTime).toBeLessThan(0.105);
    expect(playbackTime).toBeCloseTo(modelTime * 10, 10);
    expect(Number.parseFloat(await clock.innerText())).toBeCloseTo(1, 1);
    const remaining =
      Number(await page.getByTestId("collective-total").textContent()) /
      initialTotal;
    if (theorem === 2) {
      // With zero personal cost and gamma=.8, social energy decays at rate 9.6.
      expect(remaining).toBeCloseTo(Math.exp(-9.6 * modelTime), 3);
    } else {
      expect(remaining).toBeGreaterThan(0.4);
      expect(remaining).toBeLessThan(0.8);
    }
    const cursor = page.getByTestId("collective-graph-cursor");
    expect(Number(await cursor.getAttribute("data-playback-time"))).toBe(
      playbackTime,
    );
    await seek(page, 1);
    await expect(clock).toHaveAttribute("data-playback-time", "10");
    await expect(cursor).toHaveAttribute("data-playback-time", "10");
    await expect(page.getByTestId("collective-graph-time-label")).toContainText(
      "再生時間（秒）",
    );
  });
}

for (const theorem of [3] as const) {
  test(`theorem ${theorem} keeps explicit morph playback with reduced motion enabled`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await openTerrain(page, theorem, false);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    await page
      .getByRole("button", { name: "変形を最初から再生", exact: true })
      .click();
    await page.clock.runFor(1016);
    const surface = page.getByTestId("collective-terrain-surface");
    const progress = Number(await surface.getAttribute("data-intro-progress"));
    expect(progress).toBeGreaterThan(0.24);
    expect(progress).toBeLessThan(0.26);
    await expect(surface).toHaveAttribute("data-shape", "merging-wells");
    await expect(page.getByTestId("collective-time")).toHaveAttribute(
      "data-model-time",
      "0",
    );
  });

  test(`theorem ${theorem} can inspect intermediate geometry and replay while paused or playing`, async ({
    page,
  }, testInfo) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await openTerrain(page, theorem, false);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    const surface = page.getByTestId("collective-terrain-surface");
    const slider = page.getByRole("slider", {
      name: "モーフィングの進み具合",
      exact: true,
    });
    const replay = page.getByRole("button", {
      name: "変形を最初から再生",
      exact: true,
    });
    const geometry = new Set<string>();
    for (const percent of [0, 25, 50, 75, 100]) {
      await slider.fill(String(percent));
      await expect(surface).toHaveAttribute(
        "data-intro-progress",
        String(percent / 100),
      );
      geometry.add(
        await surface
          .locator("path")
          .evaluateAll((paths) =>
            paths.map((p) => p.getAttribute("d")).join(" "),
          ),
      );
      await expect(page.getByTestId("collective-time")).toHaveAttribute(
        "data-model-time",
        "0",
      );
      await expect(page.getByTestId("cl-play")).toContainText("再生");
      if (percent === 50) {
        await page.getByTestId("collective-terrain-svg").screenshot({
          path: testInfo.outputPath(`scrub-${theorem}-halfway.png`),
        });
        await page.getByTestId("collective-morph-controls").screenshot({
          path: testInfo.outputPath(`scrub-${theorem}-controls.png`),
        });
      }
    }
    expect(geometry.size).toBe(5);
    await expect(surface).toHaveAttribute("data-shape", "plane-with-well");
    // Replay starts from a paused state and restarts an already running morph.
    for (let attempt = 0; attempt < 2; attempt++) {
      await replay.click();
      await expect(surface).toHaveAttribute("data-intro-progress", "0");
      await page.clock.runFor(1000);
      const progress = Number(
        await surface.getAttribute("data-intro-progress"),
      );
      expect(progress).toBeGreaterThan(0.23);
      expect(progress).toBeLessThan(0.27);
    }
    await page.clock.runFor(4500);
    expect(
      Number(
        await page
          .getByTestId("collective-time")
          .getAttribute("data-model-time"),
      ),
    ).toBeGreaterThan(0);
    // Scrubbing after convergence starts restores the initial model state.
    await slider.fill("50");
    await expect(page.getByTestId("collective-time")).toHaveAttribute(
      "data-model-time",
      "0",
    );
    await page.clock.runFor(1000);
    await expect(surface).toHaveAttribute("data-intro-progress", "0.5");
    await replay.click();
    await page.clock.runFor(1000);
    expect(
      Number(await surface.getAttribute("data-intro-progress")),
    ).toBeLessThan(0.27);
  });
}

test("skipping changes only the introduction and returning to 3D at time zero restores it", async ({
  page,
}) => {
  await openTerrain(page, 3, false);
  const surface = page.getByTestId("collective-terrain-surface");
  const initial = await pointValues(page);
  const initialTotal = await page.getByTestId("collective-total").textContent();
  await skipIntroduction(page);
  await expect(surface).toHaveAttribute("data-intro-progress", "1");
  await expect(page.getByTestId("cl-play")).toContainText("再生");
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  expect((await pointValues(page)).x).toBe(initial.x);
  expect((await pointValues(page)).y).toBe(initial.y);
  expect(await page.getByTestId("collective-total").textContent()).toBe(
    initialTotal,
  );
  await seek(page, 2);
  const atTwo = await pointValues(page);
  await seek(page, 0);
  await expect(surface).toHaveAttribute("data-intro-progress", "0");
  await expect(surface).toHaveAttribute("data-shape", "individual-wells");
  await seek(page, 2);
  await expect(surface).toHaveAttribute("data-intro-progress", "1");
  expect(await pointValues(page)).toEqual(atTwo);
  await seek(page, 0);
  await page.getByRole("button", { name: "2D 平面", exact: true }).click();
  await page.getByRole("button", { name: "3D 地形", exact: true }).click();
  await expect(surface).toHaveAttribute("data-intro-progress", "0");
  await expect(surface).toHaveAttribute("data-shape", "individual-wells");
  await expect(page.getByTestId("collective-intro-status")).toBeVisible();
});

test("resetting, editing an agent, changing parameters and switching theorems restart the introduction", async ({
  page,
}) => {
  await openTerrain(page, 3);
  const surface = page.getByTestId("collective-terrain-surface");
  const expectInitial = async () => {
    await expect(surface).toHaveAttribute("data-intro-progress", "0");
    await expect(surface).toHaveAttribute("data-shape", "individual-wells");
    await expect(page.getByTestId("collective-time")).toContainText("0.00");
    await expect(page.getByTestId("cl-play")).toContainText("再生");
  };
  await seek(page, 2);
  await page
    .getByRole("button", { name: "時刻を0に戻す", exact: true })
    .click();
  await expectInitial();
  await skipIntroduction(page);
  await page
    .getByRole("spinbutton", { name: "主体1の初期x", exact: true })
    .fill("0.7");
  await expectInitial();
  expect((await pointValues(page)).x).toBeCloseTo(0.7, 10);
  await skipIntroduction(page);
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("0.4");
  await expectInitial();
  await skipIntroduction(page);
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: /^定理2：/ })
    .click();
  await expect(surface).toHaveAttribute("data-intro-progress", "1");
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: /^定理3：/ })
    .click();
  await expectInitial();
  expect((await pointValues(page)).x).toBeCloseTo(0.7, 10);
});

test("switching theorems keeps the coordinate frame and camera while moving the valley", async ({
  page,
}) => {
  await openTerrain(page, 2);
  const rotation = page.getByRole("slider", {
    name: "共有3D視点の回転",
    exact: true,
  });
  const elevation = page.getByRole("slider", {
    name: "共有3D視点の仰角",
    exact: true,
  });
  await rotation.fill("-40");
  await elevation.fill("38");
  const frame = page.getByTestId("collective-terrain-frame");
  const originalFrame = await frame.getAttribute("d");
  expect(originalFrame).toBeTruthy();
  const center = page.getByTestId("collective-terrain-center");
  const originalCenter = {
    x: Number(await center.getAttribute("data-screen-x")),
    y: Number(await center.getAttribute("data-screen-y")),
  };
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: /^定理3：/ })
    .click();
  await skipIntroduction(page);
  await expect(rotation).toHaveValue("-40");
  await expect(elevation).toHaveValue("38");
  await expect(frame).toHaveAttribute("d", originalFrame!);
  const lub = page.getByTestId("collective-terrain-lub");
  expect(
    Math.hypot(
      Number(await lub.getAttribute("data-screen-x")) - originalCenter.x,
      Number(await lub.getAttribute("data-screen-y")) - originalCenter.y,
    ),
  ).toBeGreaterThan(10);
});

test("the centroid stays fixed in theorem 2 and travels toward LUB in theorem 3", async ({
  page,
}) => {
  await openTerrain(page, 2);
  const initial = await centroidValues(page);
  expect(initial.x).toBeCloseTo(0.45, 10);
  expect(initial.y).toBeCloseTo(0.45, 10);
  await seek(page, 2);
  const shared = await centroidValues(page);
  expect(shared.x).toBeCloseTo(initial.x, 10);
  expect(shared.y).toBeCloseTo(initial.y, 10);
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: /^定理3：/ })
    .click();
  await skipIntroduction(page);
  const history = page.getByTestId("collective-terrain-centroid-history");
  const initialHistory = await history.getAttribute("d");
  expect(initialHistory).toBeTruthy();
  const initialLUB = await centroidValues(page);
  expect(initialLUB.x).toBeCloseTo(initial.x, 10);
  expect(initialLUB.y).toBeCloseTo(initial.y, 10);
  await seek(page, 2);
  const moving = await centroidValues(page);
  const expected = 0.8 + (0.45 - 0.8) * Math.exp(-0.8 * 2);
  expect(moving.x).toBeCloseTo(expected, 10);
  expect(moving.y).toBeCloseTo(expected, 10);
  expect(await history.getAttribute("d")).not.toBe(initialHistory);
});

test("disconnection and zero LUB force preserve the overall centroid", async ({
  page,
}) => {
  await openTerrain(page, 2);
  await page.getByRole("button", { name: "集団を分断", exact: true }).click();
  await skipIntroduction(page);
  const initial = await centroidValues(page);
  await seek(page, 2);
  const disconnected = await centroidValues(page);
  expect(disconnected.x).toBeCloseTo(initial.x, 10);
  expect(disconnected.y).toBeCloseTo(initial.y, 10);
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: /^定理3：/ })
    .click();
  await page.getByRole("slider", { name: "LUBへの力", exact: true }).fill("0");
  await skipIntroduction(page);
  const withoutForce = await centroidValues(page);
  await seek(page, 2);
  const final = await centroidValues(page);
  expect(final.x).toBeCloseTo(withoutForce.x, 10);
  expect(final.y).toBeCloseTo(withoutForce.y, 10);
});

for (const theorem of [2, 3] as const) {
  test(`theorem ${theorem} terrain has the correct height and shares state with 2D`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openTerrain(page, theorem);
    await expect(page.getByTestId("collective-terrain-svg")).toBeVisible();
    await expect(
      page.getByTestId("collective-terrain-surface"),
    ).toHaveAttribute("data-shape", "plane-with-well");
    await expect(page.locator("[data-agent-index]")).toHaveCount(3);
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`theorem-${theorem}-initial-terrain.png`),
    });
    await seek(page, 0.7);
    const before = await pointValues(page);
    if (theorem === 2) {
      expect(before.height).toBeCloseTo(
        2.4 * ((before.x - 0.45) ** 2 + (before.y - 0.45) ** 2),
        10,
      );
    } else {
      expect(before.height).toBeCloseTo(
        ((before.x - 0.8) ** 2 + (before.y - 0.8) ** 2) / 2,
        10,
      );
      await expect(page.getByTestId("collective-terrain-lub")).toHaveAttribute(
        "data-height",
        "0",
      );
    }
    for (const [rotation, elevation] of [
      [-80, 22],
      [80, 65],
    ]) {
      await page
        .getByRole("slider", { name: "共有3D視点の回転", exact: true })
        .fill(String(rotation));
      await page
        .getByRole("slider", { name: "共有3D視点の仰角", exact: true })
        .fill(String(elevation));
      expect(await pointValues(page)).toEqual(before);
      await expect(page.getByTestId("collective-time")).toContainText("0.70");
      expect(
        await page.getByTestId("collective-terrain-surface").evaluate((el) => {
          const bounds = (el as unknown as SVGGraphicsElement).getBBox();
          const view = (el as unknown as SVGGraphicsElement).ownerSVGElement!
            .viewBox.baseVal;
          return (
            bounds.x >= view.x &&
            bounds.y >= view.y &&
            bounds.x + bounds.width <= view.x + view.width &&
            bounds.y + bounds.height <= view.y + view.height
          );
        }),
      ).toBe(true);
    }
    await page
      .getByRole("slider", { name: "共有3D視点の回転", exact: true })
      .fill("-35");
    await page
      .getByRole("slider", { name: "共有3D視点の仰角", exact: true })
      .fill("35");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`theorem-${theorem}-terrain.png`),
    });
    await page.getByRole("button", { name: "2D 平面", exact: true }).click();
    await expect(page.getByTestId("collective-point-0")).toHaveAttribute(
      "data-x",
      String(before.x),
    );
    await expect(page.getByTestId("collective-point-0")).toHaveAttribute(
      "data-y",
      String(before.y),
    );
    await expect(page.getByTestId("collective-time")).toContainText("0.70");
    await page.getByRole("button", { name: "3D 地形", exact: true }).click();
    expect(await pointValues(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test("theorem 3 terrain keeps a common LUB valley while selecting agents and editing initial worlds", async ({
  page,
}) => {
  await openTerrain(page, 3);
  await page.getByRole("button", { name: "地形の主体2", exact: true }).click();
  let point = await pointValues(page);
  expect(point.x).toBe(0.2);
  expect(point.y).toBe(0.8);
  expect(point.height).toBeCloseTo(0.18, 10);
  await page
    .getByTestId("collective-terrain-point")
    .locator(".cl-terrain-current")
    .focus();
  await page.keyboard.press("ArrowUp");
  await skipIntroduction(page);
  point = await pointValues(page);
  expect(point.y).toBeCloseTo(0.82, 10);
  await expect(page.getByTestId("collective-terrain-world-1")).toHaveAttribute(
    "data-y",
    String(point.y),
  );
  await expect(page.getByTestId("collective-terrain-lub")).toHaveAttribute(
    "data-y",
    String(point.y),
  );
  const lubY = point.y;
  await seek(page, 12);
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("button", { name: `地形の主体${i}`, exact: true })
      .click();
    const final = await pointValues(page);
    expect(final.x).toBeCloseTo(0.8, 3);
    expect(final.y).toBeCloseTo(lubY, 3);
    expect(final.height).toBeLessThan(1e-7);
    await expect(page.getByTestId("collective-time")).toContainText("12.00");
  }
});

test("dragging a 3D point updates its world and the new initial state", async ({
  page,
}) => {
  await openTerrain(page, 3);
  const marker = page.getByTestId("collective-terrain-point");
  await marker.scrollIntoViewIfNeeded();
  const before = await pointValues(page);
  const screen = await marker.evaluate((el) => {
    const matrix = (
      el as unknown as SVGGraphicsElement
    ).ownerSVGElement!.getScreenCTM()!;
    const p = new DOMPoint(
      Number(el.getAttribute("data-screen-x")),
      Number(el.getAttribute("data-screen-y")),
    ).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(screen.x, screen.y);
  await page.mouse.down();
  await page.mouse.move(screen.x + 25, screen.y + 10, { steps: 5 });
  await page.mouse.up();
  await skipIntroduction(page);
  const edited = await pointValues(page);
  expect(Math.hypot(edited.x - before.x, edited.y - before.y)).toBeGreaterThan(
    0.02,
  );
  await expect(page.getByTestId("collective-terrain-world-0")).toHaveAttribute(
    "data-x",
    String(edited.x),
  );
  await expect(page.getByTestId("collective-terrain-world-0")).toHaveAttribute(
    "data-y",
    String(edited.y),
  );
  await expect(page.getByTestId("collective-time")).toContainText("0.00");
  await page.getByRole("button", { name: "2D 平面", exact: true }).click();
  await expect(page.getByTestId("collective-point-0")).toHaveAttribute(
    "data-x",
    String(edited.x),
  );
  await expect(page.getByTestId("collective-point-0")).toHaveAttribute(
    "data-y",
    String(edited.y),
  );
});

test("theorem 2 retains the connected pair valley and leaves the isolated agent on the reference plane", async ({
  page,
}) => {
  await openTerrain(page, 2);
  const center = page.getByTestId("collective-terrain-center");
  await expect(center).toHaveAttribute("data-x", "0.45");
  await expect(center).toHaveAttribute("data-y", "0.45");
  await expect(center).toHaveAttribute("data-height", "0");
  const surfaceBefore = await page
    .getByTestId("collective-terrain-surface")
    .innerHTML();
  let summed = 0;
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("button", { name: `地形の主体${i}`, exact: true })
      .click();
    summed += (await pointValues(page)).height;
    expect(
      await page.getByTestId("collective-terrain-surface").innerHTML(),
    ).toBe(surfaceBefore);
  }
  expect(summed).toBeCloseTo(0.936, 10);
  await seek(page, 12);
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("button", { name: `地形の主体${i}`, exact: true })
      .click();
    const point = await pointValues(page);
    expect(point.x).toBeCloseTo(0.45, 4);
    expect(point.y).toBeCloseTo(0.45, 4);
    expect(point.height).toBeLessThan(1e-7);
  }
  await page.getByRole("button", { name: "集団を分断", exact: true }).click();
  await skipIntroduction(page);
  await expect(page.getByTestId("collective-terrain-surface")).toHaveAttribute(
    "data-shape",
    "plane-with-well",
  );
  await expect(center).toHaveAttribute("data-x", "0.5");
  await expect(center).toHaveAttribute("data-y", "0.5");
  await expect(center).toHaveAttribute("data-members", "0,1");
  const isolated = page.locator('[data-agent-index="2"]');
  await expect(isolated).toHaveAttribute("data-isolated", "true");
  await expect(isolated).toHaveAttribute("data-display-height", "0");
  expect((await pointValues(page)).height).toBe(0);
  await seek(page, 12);
  for (let i = 1; i <= 2; i++) {
    await page
      .getByRole("button", { name: `地形の主体${i}`, exact: true })
      .click();
    const point = await pointValues(page);
    expect(point.x).toBeCloseTo(0.5, 5);
    expect(point.y).toBeCloseTo(0.5, 5);
    expect(point.height).toBeLessThan(1e-7);
  }
  expect(Number(await isolated.getAttribute("data-x"))).toBeCloseTo(0.35, 10);
  expect(Number(await isolated.getAttribute("data-y"))).toBeCloseTo(0.35, 10);
  await page.getByRole("button", { name: "個別に安定", exact: true }).click();
  await skipIntroduction(page);
  await expect(page.getByTestId("collective-terrain-surface")).toHaveAttribute(
    "data-shape",
    "flat",
  );
});

test("unequal coupling identifies the common valley as a lower bound without changing the actual cost", async ({
  page,
}) => {
  await openTerrain(page, 2);
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("0.2");
  await skipIntroduction(page);
  await expect(page.locator(".cl-terrain")).toContainText("下界");
  let displayed = 0;
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("button", { name: `地形の主体${i}`, exact: true })
      .click();
    displayed += (await pointValues(page)).height;
  }
  expect(displayed).toBeCloseTo(0.468, 10);
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeCloseTo(0.504, 3);
});

for (const theorem of [2, 3] as const) {
  test(`theorem ${theorem} shows the terrain threshold from the initial state`, async ({
    page,
  }, testInfo) => {
    await openTerrain(page, theorem);
    const thresholdSlider = page.getByRole("slider", {
      name: "安定領域の閾値",
      exact: true,
    });
    await expect(thresholdSlider).toHaveValue(theorem === 3 ? "0.03" : "0.1");
    await expect(thresholdSlider).toHaveAttribute(
      "max",
      theorem === 3 ? "0.3" : "1",
    );
    const status = page.getByTestId("collective-terrain-threshold-status");
    const area = page.getByTestId("collective-terrain-threshold-area");
    const boundary = page.getByTestId("collective-terrain-threshold-boundary");
    await expect(status).toHaveAttribute("data-kind", "disk");
    await expect(status).toHaveAttribute("data-threshold-reached", "false");
    await expect(area).toBeVisible();
    const radius = Number(await boundary.getAttribute("data-radius"));
    const center = {
      x: Number(await boundary.getAttribute("data-center-x")),
      y: Number(await boundary.getAttribute("data-center-y")),
    };
    expect(radius).toBeCloseTo(
      Math.sqrt((theorem === 2 ? 0.1 : 0.03) / (theorem === 2 ? 2.4 : 0.4)),
      10,
    );
    await seek(page, 4);
    await expect(status).toHaveAttribute("data-threshold-reached", "true");
    expect(Number(await boundary.getAttribute("data-radius"))).toBe(radius);
    expect(Number(await boundary.getAttribute("data-center-x"))).toBe(center.x);
    expect(Number(await boundary.getAttribute("data-center-y"))).toBe(center.y);
    const point = await pointValues(page);
    expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeLessThan(
      radius,
    );
    await page
      .getByRole("slider", { name: "共有3D視点の仰角", exact: true })
      .fill("58");
    await page.getByTestId("collective-terrain-svg").screenshot({
      path: testInfo.outputPath(`theorem-${theorem}-threshold.png`),
    });
    await page
      .getByRole("slider", { name: "安定領域の閾値", exact: true })
      .fill(theorem === 3 ? "0.3" : "0.5");
    await seek(page, 4);
    expect(await pointValues(page)).toEqual(point);
    expect(Number(await boundary.getAttribute("data-radius"))).toBeGreaterThan(
      radius,
    );
  });
}

test("an isolated agent has no terrain position constraint from the initial state", async ({
  page,
}, testInfo) => {
  await openTerrain(page, 2);
  await page.getByRole("button", { name: "集団を分断", exact: true }).click();
  await skipIntroduction(page);
  await page.getByRole("button", { name: "地形の主体3", exact: true }).click();
  const status = page.getByTestId("collective-terrain-threshold-status");
  await expect(status).toHaveAttribute("data-kind", "all");
  await expect(status).toHaveAttribute("data-threshold-reached", "false");
  await expect(
    page.getByTestId("collective-terrain-threshold-area"),
  ).toBeVisible();
  await seek(page, 4);
  await expect(status).toHaveAttribute("data-kind", "all");
  await expect(
    page.getByTestId("collective-terrain-threshold-area"),
  ).toBeVisible();
  await page.getByRole("button", { name: "地形の主体1", exact: true }).click();
  await expect(status).toHaveAttribute("data-kind", "disk");
  await page
    .getByRole("slider", { name: "共有3D視点の仰角", exact: true })
    .fill("58");
  await page
    .getByTestId("collective-terrain-svg")
    .screenshot({ path: testInfo.outputPath("disconnected-threshold.png") });
});

test("theorem 2 makes equal coupling changes visible without rescaling the cost axis", async ({
  page,
}, testInfo) => {
  await openTerrain(page, 2);
  const surface = page.getByTestId("collective-terrain-surface");
  const boundary = page.getByTestId("collective-terrain-threshold-boundary");
  const graph = page.getByTestId("collective-time-graph");
  const captures = [];
  for (const gamma of [0.2, 0.8]) {
    for (const pair of ["12", "13", "23"])
      await page
        .getByRole("slider", { name: `結合係数 γ${pair}`, exact: true })
        .fill(String(gamma));
    expect(
      Number(await page.getByTestId("collective-total").textContent()),
    ).toBeCloseTo(gamma === 0.2 ? 0.234 : 0.936, 3);
    const geometry = await surface.innerHTML();
    const radius = Number(await boundary.getAttribute("data-radius"));
    expect(radius).toBeCloseTo(Math.sqrt(0.1 / (3 * gamma)), 10);
    const axisMax = Number(await graph.getAttribute("data-axis-max"));
    expect(axisMax).toBeGreaterThan(0);
    const initial = await pointValues(page);
    await page
      .getByTestId("collective-terrain-svg")
      .screenshot({ path: testInfo.outputPath(`gamma-${gamma}-inline.png`) });
    await seek(page, 0.1);
    const moving = await pointValues(page);
    expect(await surface.innerHTML()).toBe(geometry);
    captures.push({
      geometry,
      radius,
      axisMax,
      initial,
      distance: Math.hypot(moving.x - 0.45, moving.y - 0.45),
    });
  }
  expect(captures[1].geometry).not.toBe(captures[0].geometry);
  expect(captures[1].initial.height).toBeCloseTo(
    4 * captures[0].initial.height,
    12,
  );
  expect(captures[1].radius).toBeCloseTo(captures[0].radius / 2, 12);
  expect(captures[1].axisMax).toBe(captures[0].axisMax);
  expect(captures[1].distance).toBeLessThan(captures[0].distance);
});

test("a single stronger edge changes actual cost and convergence even when the Q lower bound is unchanged", async ({
  page,
}) => {
  await openTerrain(page, 2);
  const graph = page.getByTestId("collective-time-graph");
  const axisMax = await graph.getAttribute("data-axis-max");
  const initial = await pointValues(page);
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeCloseTo(0.936, 3);
  await seek(page, 0.1);
  const base = await pointValues(page);
  await page
    .getByRole("slider", { name: "結合係数 γ12", exact: true })
    .fill("2");
  expect(
    Number(await page.getByTestId("collective-total").textContent()),
  ).toBeCloseTo(1.8, 3);
  expect((await pointValues(page)).height).toBeCloseTo(initial.height, 12);
  await expect(page.locator(".cl-terrain")).toContainText("下界");
  await expect(graph).toHaveAttribute("data-axis-max", axisMax!);
  await seek(page, 0.1);
  const stronger = await pointValues(page);
  expect(Math.hypot(stronger.x - 0.45, stronger.y - 0.45)).toBeLessThan(
    Math.hypot(base.x - 0.45, base.y - 0.45),
  );
});
