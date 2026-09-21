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
