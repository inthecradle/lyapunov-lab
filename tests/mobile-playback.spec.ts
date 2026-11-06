import { test, expect, type Page } from "@playwright/test";

async function expectTerrainAndControlsInView(page: Page) {
  const viewportHeight = page.viewportSize()!.height;
  for (const locator of [
    page.getByTestId("state-space"),
    page.locator(".transport"),
  ]) {
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewportHeight + 1);
  }
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 740 },
]) {
  test(`mobile playback keeps terrain and controls together at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile layout regression");
    await page.setViewportSize(viewport);
    await page.goto("./");
    await page.clock.install();
    await page.locator(".state-panel").evaluate((panel) => {
      panel.scrollIntoView({ block: "start", behavior: "instant" });
    });

    await expectTerrainAndControlsInView(page);
    const controls = (await page.locator(".transport").boundingBox())!;
    const graph = (await page.locator(".graph-panel").boundingBox())!;
    expect(graph.y).toBeGreaterThanOrEqual(controls.y + controls.height);
    const initialScroll = await page.evaluate(() => window.scrollY);
    const initialX = await page
      .getByTestId("state-point")
      .getAttribute("data-x");

    await page
      .getByRole("button", { name: "シミュレーションを再生", exact: true })
      .click();
    await page.clock.runFor(1100);
    expect(
      Number(
        (await page.getByTestId("time-output").textContent())!.split("/")[0],
      ),
    ).toBeGreaterThan(0.9);
    await expect(page.getByTestId("state-point")).not.toHaveAttribute(
      "data-x",
      initialX!,
    );
    await expectTerrainAndControlsInView(page);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - initialScroll),
    ).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    const paused = (await page.getByTestId("time-output").textContent())!;
    await page.clock.runFor(500);
    await expect(page.getByTestId("time-output")).toHaveText(paused);
    await page.getByRole("slider", { name: "時間", exact: true }).fill("4");
    await expect(page.getByTestId("time-output")).toContainText("4.00");
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    await expect(page.getByTestId("time-output")).toContainText("0.00");
    await expectTerrainAndControlsInView(page);
  });
}

test("desktop retains both plots side by side with playback beneath them", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop layout regression");
  await page.goto("./");
  const terrain = (await page.locator(".state-panel").boundingBox())!;
  const graph = (await page.locator(".graph-panel").boundingBox())!;
  const controls = (await page.locator(".transport").boundingBox())!;
  expect(Math.abs(terrain.y - graph.y)).toBeLessThanOrEqual(1);
  expect(graph.x).toBeGreaterThanOrEqual(terrain.x + terrain.width);
  expect(controls.y).toBeGreaterThanOrEqual(
    Math.max(terrain.y + terrain.height, graph.y + graph.height),
  );
});

async function chooseCollectiveTheorem(
  page: Page,
  theorem: 2 | 3,
  view: "2d" | "3d",
) {
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: new RegExp(`^定理${theorem}：`) })
    .click();
  await page
    .getByRole("button", {
      name: view === "2d" ? "2D 平面" : "3D 地形",
      exact: true,
    })
    .click();
}

async function collectivePoint(page: Page, view: "2d" | "3d") {
  const marker = page.getByTestId(
    view === "2d" ? "collective-point-0" : "collective-terrain-point",
  );
  return {
    x: Number(await marker.getAttribute("data-x")),
    y: Number(await marker.getAttribute("data-y")),
  };
}

async function expectInlineCollectiveControls(page: Page) {
  await expect(
    page.getByTestId("collective-playback-dialog"),
  ).not.toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByTestId("cl-play")).toHaveCount(1);
  await expect(page.getByTestId("cl-time")).toHaveCount(1);
  await expect(page.locator(".cl-state-panel .cl-transport")).toBeVisible();
  const width = page.viewportSize()!.width;
  for (const control of [
    page.getByTestId("cl-play"),
    page.getByTestId("cl-time"),
    page.getByRole("button", { name: "時刻を0に戻す", exact: true }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("a desktop morph transfers to inline 2D without an invisible introduction delay", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop to inline 2D transition",
  );
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseCollectiveTheorem(page, 3, "2d");
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  await dialog
    .getByRole("button", { name: "変形を最初から再生", exact: true })
    .click();
  await page.clock.runFor(1016);
  await expect(dialog.getByTestId("convergence-surface")).toHaveAttribute(
    "data-shape",
    "merging-wells",
  );
  await expect(dialog.getByTestId("collective-time")).toHaveAttribute(
    "data-model-time",
    "0",
  );

  await page.setViewportSize({ width: 760, height: 1000 });
  await expectInlineCollectiveControls(page);
  const time = page.getByTestId("collective-time");
  await expect(time).toHaveAttribute("data-model-time", "0");
  await expect(page.getByTestId("cl-play")).toContainText("一時停止");
  await page.clock.runFor(1016);
  expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(
    0.09,
  );
});

for (const theorem of [2, 3] as const) {
  for (const view of ["2d", "3d"] as const) {
    for (const width of [320, 760]) {
      test(`theorem ${theorem} ${view} plays inline with working controls at ${width}px`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== "mobile",
          "Mobile inline collective playback",
        );
        await page.setViewportSize({ width, height: 844 });
        await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
        await page.goto("./");
        await chooseCollectiveTheorem(page, theorem, view);
        await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
        const play = page.getByTestId("cl-play");
        const time = page.getByTestId("collective-time");
        const timeline = page.getByTestId("cl-time");
        const initial = await collectivePoint(page, view);
        await expectInlineCollectiveControls(page);
        await play.click();
        await expect(play).toContainText("一時停止");
        await expectInlineCollectiveControls(page);
        await expect(
          page.getByRole("button", {
            name: view === "2d" ? "2D 平面" : "3D 地形",
            exact: true,
          }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.clock.runFor(1016);
        if (theorem === 3 && view === "3d") {
          const surface = page.getByTestId("collective-terrain-surface");
          await expect(surface).toHaveAttribute("data-shape", "merging-wells");
          await expect(time).toHaveAttribute("data-model-time", "0");
          expect(await collectivePoint(page, view)).toEqual(initial);
          await play.click();
          const pausedIntro = await surface.getAttribute("data-intro-progress");
          await page.clock.runFor(500);
          await expect(surface).toHaveAttribute(
            "data-intro-progress",
            pausedIntro!,
          );
          await play.click();
          await expect(surface).toHaveAttribute(
            "data-intro-progress",
            pausedIntro!,
          );
          await page.clock.runFor(4100);
          await expect(surface).toHaveAttribute("data-intro-progress", "1");
        }
        expect(
          Number(await time.getAttribute("data-model-time")),
        ).toBeGreaterThan(0.09);
        expect(await collectivePoint(page, view)).not.toEqual(initial);
        await expectInlineCollectiveControls(page);
        await play.click();
        const pausedTime = await time.getAttribute("data-model-time");
        const pausedPoint = await collectivePoint(page, view);
        await page.clock.runFor(500);
        await expect(time).toHaveAttribute("data-model-time", pausedTime!);
        expect(await collectivePoint(page, view)).toEqual(pausedPoint);
        await timeline.fill("4");
        await expect(time).toHaveAttribute("data-model-time", "4");
        await expect(
          page.getByTestId("collective-graph-cursor"),
        ).toHaveAttribute("data-time", "4");
        await expect(play).toContainText("再生");
        await play.click();
        await page.clock.runFor(500);
        expect(
          Number(await time.getAttribute("data-model-time")),
        ).toBeGreaterThan(4);
        await expectInlineCollectiveControls(page);
        // Reset must also stop a running animation on the original graph.
        await page
          .getByRole("button", { name: "時刻を0に戻す", exact: true })
          .click();
        await expect(time).toHaveAttribute("data-model-time", "0");
        await expect(play).toContainText("再生");
        expect(await collectivePoint(page, view)).toEqual(initial);
        await page.clock.runFor(500);
        await expect(time).toHaveAttribute("data-model-time", "0");
        await expectInlineCollectiveControls(page);
        if (theorem === 3 && view === "2d") {
          // Resetting the 2D view must not introduce an invisible four-second wait.
          await play.click();
          await page.clock.runFor(1016);
          expect(
            Number(await time.getAttribute("data-model-time")),
          ).toBeGreaterThan(0.09);
        }
      });
    }
  }

  test(`theorem ${theorem} transfers desktop playback inline at the 760px breakpoint without pausing`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Desktop to compact playback transition",
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 761, height: 1000 });
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await page.goto("./");
    const view = theorem === 2 ? "2d" : "3d";
    await chooseCollectiveTheorem(page, theorem, view);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    await page.getByTestId("cl-play").click();
    const dialog = page.getByTestId("collective-playback-dialog");
    await expect(dialog).toBeVisible();
    await page.clock.runFor(1016);
    if (theorem === 3) {
      const surface = dialog.getByTestId("convergence-surface");
      await expect(surface).toHaveAttribute("data-shape", "merging-wells");
      const progress = await surface.getAttribute("data-intro-progress");
      await expect(dialog.getByTestId("collective-time")).toHaveAttribute(
        "data-model-time",
        "0",
      );
      await page.setViewportSize({ width: 760, height: 1000 });
      await expectInlineCollectiveControls(page);
      await expect(
        page.getByTestId("collective-terrain-surface"),
      ).toHaveAttribute("data-intro-progress", progress!);
      await expect(page.getByTestId("cl-play")).toContainText("一時停止");
      await page.clock.runFor(4100);
      await expect(
        page.getByTestId("collective-terrain-surface"),
      ).toHaveAttribute("data-intro-progress", "1");
    }
    const beforeResize = Number(
      await page.getByTestId("collective-time").getAttribute("data-model-time"),
    );
    expect(beforeResize).toBeGreaterThan(0.09);
    const beforePoint = await collectivePoint(page, view);
    await page.setViewportSize({ width: 760, height: 1000 });
    await expectInlineCollectiveControls(page);
    const time = page.getByTestId("collective-time");
    await expect(time).toHaveAttribute("data-model-time", String(beforeResize));
    expect(await collectivePoint(page, view)).toEqual(beforePoint);
    await expect(page.getByTestId("cl-play")).toContainText("一時停止");
    await page.clock.runFor(500);
    expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(
      beforeResize,
    );
    expect(await collectivePoint(page, view)).not.toEqual(beforePoint);
    await page.getByTestId("cl-play").click();
    const paused = await time.getAttribute("data-model-time");
    await page.clock.runFor(500);
    await expect(time).toHaveAttribute("data-model-time", paused!);
    await page.getByTestId("cl-time").fill("2");
    await expect(time).toHaveAttribute("data-model-time", "2");
    await page
      .getByRole("button", { name: "時刻を0に戻す", exact: true })
      .click();
    await expect(time).toHaveAttribute("data-model-time", "0");
    await expectInlineCollectiveControls(page);
    expect(errors).toEqual([]);
  });
}
