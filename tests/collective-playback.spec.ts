import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_COLLECTIVE, sampleCollective } from "../src/model/collective";
import { collectiveAgentCosts } from "../src/model/collectivePlayback";

// Compact layouts play on the existing graph; popup behavior belongs to desktop.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop popup playback");
});

async function chooseTheorem(page: Page, theorem: 2 | 3, skipIntro = true) {
  await page
    .getByRole("navigation", { name: "定理を選ぶ" })
    .getByRole("button", { name: new RegExp(`^定理${theorem}：`) })
    .click();
  if (theorem === 3 && skipIntro)
    await page
      .getByRole("button", { name: "導入をスキップ", exact: true })
      .click();
}

async function markerValues(page: Page, kind: "initial" | "agent") {
  return Promise.all(
    [0, 1, 2].map(async (i) => {
      const marker = page.getByTestId(`convergence-${kind}-${i}`);
      return {
        height: Number(await marker.getAttribute("data-height")),
        displayHeight: Number(await marker.getAttribute("data-display-height")),
        screenY: Number(await marker.getAttribute("data-screen-y")),
      };
    }),
  );
}

test("theorem 3 main playback morphs the terrain before convergence and resumes its introduction", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseTheorem(page, 3, false);
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  const surface = dialog.getByTestId("convergence-surface");
  const time = dialog.getByTestId("collective-time");
  const play = dialog.getByTestId("cl-play");
  await expect(dialog).toBeVisible();
  await expect(surface).toHaveAttribute("data-intro-progress", "0");
  await expect(surface).toHaveAttribute("data-shape", "individual-wells");
  const initialGeometry = await surface.innerHTML();
  const chartValues = () =>
    Promise.all(
      [0, 1, 2].map(async (i) =>
        Number(
          await dialog
            .getByTestId(`convergence-height-agent-${i}`)
            .getAttribute("data-height"),
        ),
      ),
    );
  const initial = await chartValues();
  await page.clock.runFor(1016);
  await expect(surface).toHaveAttribute("data-shape", "merging-wells");
  const progress = Number(await surface.getAttribute("data-intro-progress"));
  expect(progress).toBeGreaterThan(0.24);
  expect(progress).toBeLessThan(0.26);
  expect(await surface.innerHTML()).not.toBe(initialGeometry);
  await expect(time).toHaveAttribute("data-model-time", "0");
  expect(await chartValues()).toEqual(initial);
  await play.click();
  const pausedProgress = await surface.getAttribute("data-intro-progress");
  await page.clock.runFor(500);
  await expect(surface).toHaveAttribute("data-intro-progress", pausedProgress!);
  await play.click();
  await expect(surface).toHaveAttribute("data-intro-progress", pausedProgress!);
  await page.clock.runFor(1016);
  expect(
    Number(await surface.getAttribute("data-intro-progress")),
  ).toBeGreaterThan(progress);
  await expect(time).toHaveAttribute("data-model-time", "0");
  await dialog.screenshot({
    path: testInfo.outputPath("theorem-3-playback-morph.png"),
  });
  await page.clock.runFor(3100);
  await expect(surface).toHaveAttribute("data-intro-progress", "1");
  await expect(surface).toHaveAttribute("data-shape", "plane-with-well");
  expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(
    0.09,
  );
  const converging = await chartValues();
  for (let i = 0; i < 3; i++) expect(converging[i]).toBeLessThan(initial[i]);
  // The threshold geometry must use the completed cost surface, including
  // when the dialog was originally mounted with the conceptual intro visible.
  const boundary = dialog.getByTestId("convergence-threshold-boundary");
  const completedBoundary = await boundary.innerHTML();
  await page.keyboard.press("Escape");
  await page.getByTestId("cl-play").click();
  expect(await boundary.innerHTML()).toBe(completedBoundary);
});

test("theorem 3 popup replays its morph and preserves it when reopened from 2D", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseTheorem(page, 3);
  await page.getByRole("button", { name: "2D 平面", exact: true }).click();
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  const surface = dialog.getByTestId("convergence-surface");
  const time = dialog.getByTestId("collective-time");
  await page.clock.runFor(1016);
  expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(0);
  await dialog.getByTestId("cl-play").click();
  await dialog
    .getByRole("button", { name: "変形を最初から再生", exact: true })
    .click();
  await expect(time).toHaveAttribute("data-model-time", "0");
  await expect(surface).toHaveAttribute("data-intro-progress", "0");
  await expect(dialog.getByTestId("cl-play")).toContainText("一時停止");
  await page.clock.runFor(1016);
  const progress = await surface.getAttribute("data-intro-progress");
  expect(Number(progress)).toBeGreaterThan(0.24);
  expect(Number(progress)).toBeLessThan(0.26);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.clock.runFor(500);
  await page.getByTestId("cl-play").click();
  await expect(surface).toHaveAttribute("data-intro-progress", progress!);
  await page.clock.runFor(4100);
  await expect(surface).toHaveAttribute("data-intro-progress", "1");
  expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(
    0.09,
  );
});

test("theorem 3 popup can skip its introduction without changing model time", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseTheorem(page, 3, false);
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  await page.clock.runFor(500);
  await dialog
    .getByRole("button", { name: "導入をスキップ", exact: true })
    .click();
  await expect(dialog.getByTestId("convergence-surface")).toHaveAttribute(
    "data-intro-progress",
    "1",
  );
  await expect(dialog.getByTestId("collective-time")).toHaveAttribute(
    "data-model-time",
    "0",
  );
  await page.clock.runFor(1016);
  expect(
    Number(
      await dialog
        .getByTestId("collective-time")
        .getAttribute("data-model-time"),
    ),
  ).toBeGreaterThan(0.09);
});

for (const theorem of [2, 3] as const) {
  test(`theorem ${theorem} stops at the end and restarts with its correct introduction`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await page.goto("./");
    await chooseTheorem(page, theorem);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    await page.getByTestId("cl-time").fill("11.99");
    await page.getByTestId("cl-play").click();
    const dialog = page.getByTestId("collective-playback-dialog");
    const time = dialog.getByTestId("collective-time");
    const play = dialog.getByTestId("cl-play");
    await page.clock.runFor(500);
    await expect(time).toHaveAttribute("data-model-time", "12");
    await expect(play).toContainText("再生");
    await page.clock.runFor(500);
    await expect(time).toHaveAttribute("data-model-time", "12");
    await play.click();
    await expect(time).toHaveAttribute("data-model-time", "0");
    await expect(dialog.getByTestId("convergence-surface")).toHaveAttribute(
      "data-intro-progress",
      theorem === 3 ? "0" : "1",
    );
    await page.clock.runFor(1016);
    if (theorem === 3) {
      await expect(time).toHaveAttribute("data-model-time", "0");
      await expect(dialog.getByTestId("convergence-surface")).toHaveAttribute(
        "data-shape",
        "merging-wells",
      );
    } else {
      expect(
        Number(await time.getAttribute("data-model-time")),
      ).toBeGreaterThan(0.09);
    }
  });

  test(`theorem ${theorem} playback keeps absolute heights and initial markers while converging`, async ({
    page,
  }, testInfo) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await page.goto("./");
    await chooseTheorem(page, theorem);
    // Playback also opens the terrain from the 2D editing view.
    if (theorem === 2)
      await page.getByRole("button", { name: "2D 平面", exact: true }).click();
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    await page.getByTestId("cl-play").click();

    const dialog = page.getByTestId("collective-playback-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("open", "");
    await expect(page.getByTestId("cl-play")).toHaveCount(1);
    await expect(dialog.getByTestId("cl-play")).toContainText("一時停止");
    const terrain = dialog.getByTestId("convergence-terrain");
    const surface = dialog.getByTestId("convergence-surface");
    const axis = dialog.getByTestId("convergence-axis");
    const axisMax = Number(await terrain.getAttribute("data-axis-max"));
    expect(axisMax).toBeGreaterThan(0);
    const initialSurface = await surface.innerHTML();
    const initialAxis = await axis.innerHTML();
    const chart = dialog.getByTestId("convergence-heights");
    const chartAxisMax = Number(await chart.getAttribute("data-axis-max"));
    expect(chartAxisMax).toBeGreaterThan(0);
    const initialChartHeights = await Promise.all(
      [0, 1, 2].map(async (i) =>
        Number(
          await dialog
            .getByTestId(`convergence-height-initial-${i}`)
            .getAttribute("data-height"),
        ),
      ),
    );
    const initial = await markerValues(page, "initial");
    const starting = await markerValues(page, "agent");
    expect(starting.map((point) => point.height)).toEqual(
      initial.map((point) => point.height),
    );

    await page.clock.runFor(1016);
    expect(
      Number(
        await dialog
          .getByTestId("collective-time")
          .getAttribute("data-model-time"),
      ),
    ).toBeGreaterThan(0.09);
    await dialog.getByTestId("cl-play").click();
    const pausedTime = await dialog
      .getByTestId("collective-time")
      .textContent();
    await page.clock.runFor(500);
    await expect(dialog.getByTestId("collective-time")).toHaveText(pausedTime!);
    await dialog.getByTestId("cl-time").fill("4");
    const converged = await markerValues(page, "agent");
    for (let i = 0; i < 3; i++) {
      expect(initial[i].height).toBeGreaterThan(0);
      expect(converged[i].height).toBeLessThan(initial[i].height * 0.01);
      expect(converged[i].displayHeight).toBeLessThan(initial[i].displayHeight);
      // The 3D surface uses the original well shape; the height chart stays linear.
      const displayMax = Number(await terrain.getAttribute("data-display-max"));
      expect(initial[i].displayHeight).toBeCloseTo(
        -210 * Math.max(0, 1 - initial[i].height / displayMax) ** 3,
        8,
      );
      const initialY = Number(
        await dialog
          .getByTestId(`convergence-height-initial-${i}`)
          .getAttribute("cy"),
      );
      const currentY = Number(
        await dialog
          .getByTestId(`convergence-height-agent-${i}`)
          .getAttribute("cy"),
      );
      const currentChartHeight = Number(
        await dialog
          .getByTestId(`convergence-height-agent-${i}`)
          .getAttribute("data-height"),
      );
      expect(
        (currentY - initialY) / (initialChartHeights[i] - currentChartHeight),
      ).toBeCloseTo((theorem === 2 ? 170 : 192) / chartAxisMax, 8);
      expect(
        Number(
          await dialog
            .getByTestId(`convergence-height-initial-${i}`)
            .getAttribute("data-height"),
        ),
      ).toBe(initialChartHeights[i]);
      if (theorem === 3) expect(initialChartHeights[i]).toBe(initial[i].height);
    }
    await expect(surface).toHaveAttribute("data-shape", "plane-with-well");
    expect(await markerValues(page, "initial")).toEqual(initial);
    await expect(terrain).toHaveAttribute("data-axis-max", String(axisMax));
    await expect(chart).toHaveAttribute("data-axis-max", String(chartAxisMax));
    expect(await surface.innerHTML()).toBe(initialSurface);
    expect(await axis.innerHTML()).toBe(initialAxis);
    await dialog.screenshot({
      path: testInfo.outputPath(`convergence-${theorem}.png`),
    });

    await dialog.getByTestId("cl-play").click();
    await dialog
      .getByRole("button", { name: "閉じて一時停止", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const closedTime = await page.getByTestId("collective-time").textContent();
    await page.clock.runFor(500);
    await expect(page.getByTestId("collective-time")).toHaveText(closedTime!);
    await expect(page.getByTestId("cl-play")).toContainText("再生");
    await expect(page.getByTestId("cl-play")).toBeFocused();

    await page.getByTestId("cl-play").click();
    await expect(dialog).toBeVisible();
    await page.clock.runFor(250);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    const escapedTime = await page.getByTestId("collective-time").textContent();
    await page.clock.runFor(500);
    await expect(page.getByTestId("collective-time")).toHaveText(escapedTime!);
    await expect(page.getByTestId("cl-play")).toContainText("再生");
  });
}

for (const theorem of [2, 3] as const) {
  test(`theorem ${theorem} playback rotates a fixed threshold region without changing the dynamics`, async ({
    page,
  }, testInfo) => {
    await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
    await page.goto("./");
    await chooseTheorem(page, theorem);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
    await page.getByTestId("cl-play").click();

    const dialog = page.getByTestId("collective-playback-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("cl-play").click();
    const time = dialog.getByTestId("collective-time");
    const terrain = dialog.getByTestId("convergence-terrain");
    const surface = dialog.getByTestId("convergence-surface");
    const area = dialog.getByTestId("convergence-threshold-area");
    const boundary = dialog.getByTestId("convergence-threshold-boundary");
    const status = dialog.getByTestId("convergence-threshold-status");
    const rotation = dialog.getByRole("slider", { name: "収束3D視点の回転" });
    const elevation = dialog.getByRole("slider", { name: "収束3D視点の仰角" });
    await expect(rotation).toHaveAttribute("min", "-80");
    await expect(rotation).toHaveAttribute("max", "80");
    await expect(rotation).toHaveValue("-28");
    await expect(elevation).toHaveAttribute("min", "22");
    await expect(elevation).toHaveAttribute("max", "65");
    await expect(elevation).toHaveValue("28");
    await expect(area).toHaveAttribute("data-kind", "disk");
    await expect(status).toHaveAttribute("data-threshold-reached", "false");
    await expect(dialog).toContainText("必要条件");
    await expect(dialog).toContainText("合成評価");
    await expect(
      dialog.getByTestId("convergence-height-threshold"),
    ).toBeVisible();
    const radius = await boundary.getAttribute("data-radius");
    expect(Number(radius)).toBeCloseTo(
      Math.sqrt((theorem === 2 ? 0.1 : 0.03) / (theorem === 2 ? 2.4 : 0.4)),
      10,
    );
    const centerX = await boundary.getAttribute("data-center-x");
    const centerY = await boundary.getAttribute("data-center-y");
    expect(centerX).not.toBeNull();
    expect(centerY).not.toBeNull();
    expect(Number.isFinite(Number(centerX))).toBe(true);
    expect(Number.isFinite(Number(centerY))).toBe(true);
    const axisMax = await terrain.getAttribute("data-axis-max");
    const initialTime = await time.getAttribute("data-model-time");
    const initialHeights = (await markerValues(page, "agent")).map(
      ({ height }) => height,
    );
    const initialSurface = await surface.innerHTML();
    const initialBoundary = await boundary.innerHTML();

    await rotation.fill("35");
    expect(await surface.innerHTML()).not.toBe(initialSurface);
    expect(await boundary.innerHTML()).not.toBe(initialBoundary);
    const rotatedSurface = await surface.innerHTML();
    const rotatedBoundary = await boundary.innerHTML();
    await elevation.fill("48");
    expect(await surface.innerHTML()).not.toBe(rotatedSurface);
    expect(await boundary.innerHTML()).not.toBe(rotatedBoundary);
    await expect(time).toHaveAttribute("data-model-time", initialTime!);
    expect(
      (await markerValues(page, "agent")).map(({ height }) => height),
    ).toEqual(initialHeights);
    await expect(terrain).toHaveAttribute("data-axis-max", axisMax!);
    await expect(boundary).toHaveAttribute("data-radius", radius!);
    await expect(boundary).toHaveAttribute("data-center-x", centerX!);
    await expect(boundary).toHaveAttribute("data-center-y", centerY!);
    await dialog.screenshot({
      path: testInfo.outputPath(`rotated-theorem-${theorem}.png`),
    });

    const fixedSurface = await surface.innerHTML();
    const fixedBoundary = await boundary.innerHTML();
    await dialog.getByTestId("cl-time").fill("4");
    await expect(status).toHaveAttribute("data-threshold-reached", "true");
    await expect(boundary).toHaveAttribute("data-radius", radius!);
    await expect(boundary).toHaveAttribute("data-center-x", centerX!);
    await expect(boundary).toHaveAttribute("data-center-y", centerY!);
    expect(await surface.innerHTML()).toBe(fixedSurface);
    expect(await boundary.innerHTML()).toBe(fixedBoundary);

    // Camera controls remain usable during playback and do not reset its clock.
    await dialog.getByTestId("cl-time").fill("1");
    await dialog.getByTestId("cl-play").click();
    await page.clock.runFor(500);
    const beforeRotation = Number(await time.getAttribute("data-model-time"));
    const playingHeights = (await markerValues(page, "agent")).map(
      ({ height }) => height,
    );
    await rotation.fill("-45");
    await elevation.fill("35");
    await expect(time).toHaveAttribute(
      "data-model-time",
      String(beforeRotation),
    );
    expect(
      (await markerValues(page, "agent")).map(({ height }) => height),
    ).toEqual(playingHeights);
    await page.clock.runFor(500);
    expect(Number(await time.getAttribute("data-model-time"))).toBeGreaterThan(
      beforeRotation,
    );
    await expect(dialog.getByTestId("cl-play")).toContainText("一時停止");
    await expect(terrain).toHaveAttribute("data-axis-max", axisMax!);
  });
}

test("theorem 3 playback shades the whole terrain when the LUB coefficient is zero", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 3);
  await page.getByRole("slider", { name: "LUBへの力", exact: true }).fill("0");
  await page
    .getByRole("button", { name: "導入をスキップ", exact: true })
    .click();
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  await expect(
    dialog.getByTestId("convergence-threshold-area"),
  ).toHaveAttribute("data-kind", "all");
  await expect(dialog.locator(".cl-playback-threshold")).toContainText("全域");
});

test("theorem 2 playback retains a coupling threshold region for a disconnected graph", async ({
  page,
}) => {
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page
    .getByRole("slider", { name: "結合係数 γ13", exact: true })
    .fill("0");
  await page
    .getByRole("slider", { name: "結合係数 γ23", exact: true })
    .fill("0");
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  await expect(
    dialog.getByTestId("convergence-threshold-area"),
  ).toHaveAttribute("data-kind", "disk");
  expect(
    Number(
      await dialog
        .getByTestId("convergence-threshold-boundary")
        .getAttribute("data-radius"),
    ),
  ).toBeGreaterThan(0);
});

test("theorem 2 separates personal and social costs on fixed absolute stacked bars", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  await page.getByTestId("cl-play").click();
  const dialog = page.getByTestId("collective-playback-dialog");
  await dialog.getByTestId("cl-play").click();
  await expect(dialog).toContainText("主体別の評価");
  await expect(dialog).toContainText("個人の不快");
  await expect(dialog).toContainText("相互の不整合");
  await expect(dialog).toContainText("不一致費用Q");
  const chart = dialog.getByTestId("convergence-heights");
  const axisMax = Number(await chart.getAttribute("data-axis-max"));
  const initialCosts = collectiveAgentCosts(
    sampleCollective(0, DEFAULT_COLLECTIVE),
    DEFAULT_COLLECTIVE,
  );
  expect(initialCosts.map((cost) => cost.personal)).toEqual([0, 0, 0]);
  expect(initialCosts.every((cost) => cost.social > 0)).toBe(true);
  const initialBars = await chart.innerHTML();
  for (const time of [0, 0.3, 4, 0.3]) {
    await dialog.getByTestId("cl-time").fill(String(time));
    const currentCosts = collectiveAgentCosts(
      sampleCollective(time, DEFAULT_COLLECTIVE),
      DEFAULT_COLLECTIVE,
    );
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      for (const kind of ["initial", "agent"] as const) {
        const expected = kind === "initial" ? initialCosts[i] : currentCosts[i];
        for (const component of ["personal", "social"] as const) {
          const bar = dialog.getByTestId(
            `convergence-cost-${kind}-${component}-${i}`,
          );
          const value = Number(await bar.getAttribute("data-value"));
          if (component === "personal") expect(value).toBe(0);
          expect(value).toBeCloseTo(expected[component], 12);
          expect(Number(await bar.getAttribute("height"))).toBeCloseTo(
            (170 * value) / axisMax,
            8,
          );
        }
        const marker = dialog.getByTestId(`convergence-height-${kind}-${i}`);
        expect(Number(await marker.getAttribute("data-height"))).toBeCloseTo(
          expected.total,
          12,
        );
        expect(expected.total).toBeGreaterThanOrEqual(expected.personal);
        expect(expected.total).toBeLessThanOrEqual(axisMax);
      }
      sum += currentCosts[i].total;
    }
    expect(sum).toBeCloseTo(
      sampleCollective(time, DEFAULT_COLLECTIVE).total,
      12,
    );
    await expect(chart).toHaveAttribute("data-axis-max", String(axisMax));
  }
  expect(await chart.innerHTML()).not.toBe(initialBars);
  await dialog.getByTestId("cl-time").fill("0");
  expect(await chart.innerHTML()).toBe(initialBars);
});

test("theorem 2 popup preserves gamma comparisons in the terrain and absolute cost bars", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("./");
  await chooseTheorem(page, 2);
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  const dialog = page.getByTestId("collective-playback-dialog");
  const captures = [];
  for (const gamma of [0.2, 0.8]) {
    for (const pair of ["12", "13", "23"])
      await page
        .getByRole("slider", { name: `結合係数 γ${pair}`, exact: true })
        .fill(String(gamma));
    const graphAxis = Number(
      await page
        .getByTestId("collective-time-graph")
        .getAttribute("data-axis-max"),
    );
    await page.getByTestId("cl-play").click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("cl-play").click();
    const chart = dialog.getByTestId("convergence-heights");
    const axisMax = Number(await chart.getAttribute("data-axis-max"));
    expect(axisMax).toBe(graphAxis);
    const bars = await Promise.all(
      [0, 1, 2].map(async (i) => {
        const bar = dialog.getByTestId(`convergence-cost-initial-social-${i}`);
        return {
          value: Number(await bar.getAttribute("data-value")),
          height: Number(await bar.getAttribute("height")),
        };
      }),
    );
    const points = await markerValues(page, "initial");
    const terrain = dialog.getByTestId("convergence-terrain");
    const displayMax = Number(await terrain.getAttribute("data-display-max"));
    expect(displayMax).toBeCloseTo((0.85 * 2.4) / 1.12 ** 2, 12);
    const radius = Number(
      await dialog
        .getByTestId("convergence-threshold-boundary")
        .getAttribute("data-radius"),
    );
    const surface = await dialog.getByTestId("convergence-surface").innerHTML();
    captures.push({ bars, points, displayMax, radius, surface, axisMax });
    await dialog.screenshot({
      path: testInfo.outputPath(`gamma-${gamma}-popup.png`),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }
  const [weak, strong] = captures;
  expect(strong.axisMax).toBe(weak.axisMax);
  expect(strong.displayMax).toBe(weak.displayMax);
  expect(strong.surface).not.toBe(weak.surface);
  expect(strong.radius).toBeCloseTo(weak.radius / 2, 12);
  for (let i = 0; i < 3; i++) {
    expect(strong.bars[i].value).toBeCloseTo(weak.bars[i].value * 4, 12);
    expect(strong.bars[i].height).toBeCloseTo(weak.bars[i].height * 4, 8);
    expect(strong.points[i].height).toBeCloseTo(weak.points[i].height * 4, 12);
    expect(strong.points[i].displayHeight).toBeGreaterThan(
      weak.points[i].displayHeight,
    );
  }
});
