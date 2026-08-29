import { expect, test, type Page } from "@playwright/test";

import { articleCloseAtIst } from "../../src/lib/deadline";

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

async function injectWallet(page: Page) {
  await page.addInitScript(({ account }) => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const provider = {
      isMetaMask: true,
      selectedAddress: account,
      chainId: "0x279f",
      on(event: string, callback: (...args: unknown[]) => void) {
        const callbacks = listeners.get(event) ?? new Set();
        callbacks.add(callback);
        listeners.set(event, callbacks);
        return provider;
      },
      removeListener(event: string, callback: (...args: unknown[]) => void) {
        listeners.get(event)?.delete(callback);
        return provider;
      },
      async request({
        method,
        params = [],
      }: {
        method: string;
        params?: unknown[];
      }) {
        if (method === "eth_requestAccounts" || method === "eth_accounts") {
          return [account];
        }
        if (method === "eth_chainId") return "0x279f";
        if (
          method === "wallet_switchEthereumChain" ||
          method === "wallet_addEthereumChain"
        ) {
          return null;
        }
        const response = await fetch("http://127.0.0.1:8546", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          }),
        });
        const body = await response.json();
        if (body.error) throw new Error(body.error.message);
        return body.result;
      },
    };
    Object.defineProperty(window, "ethereum", {
      value: provider,
      configurable: false,
    });
  }, { account: ACCOUNT });
}

test.beforeEach(async ({ page }) => {
  await injectWallet(page);
  await page.goto("/");
});

test("renders an editorial news market without overflow", async ({ page }) => {
  await expect(page.getByRole("link", { name: "THEYA briefs" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "THEYA makes daily news actionable",
    }),
  ).toBeVisible();
  await expect(page.getByText("0.01 MON").first()).toBeVisible();
  await expect(page.getByText("ONE POSITION PER WALLET")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("filters stories with functional category tabs", async ({ page }) => {
  for (const category of [
    "Top",
    "World",
    "Politics",
    "Business",
    "Technology",
    "Science",
    "Health",
    "Sports",
    "Entertainment",
    "Crypto",
  ]) {
    await expect(
      page.getByRole("button", { name: category, exact: true }),
    ).toBeAttached();
  }

  await page.getByRole("button", { name: "World", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "World leaders prepare for a scheduled summit",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "THEYA makes daily news actionable",
    }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "THEYA briefs" }).click();
  await expect(
    page.getByRole("heading", {
      name: "THEYA makes daily news actionable",
    }),
  ).toBeVisible();
});

test("shows declared and final resolution sources", async ({ page }) => {
  await expect(
    page.getByLabel("Declared resolution sources").getByRole("link", {
      name: /Monad Docs/,
    }),
  ).toHaveAttribute("href", "https://docs.monad.xyz/");

  await page.getByRole("button", { name: "World", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Final evidence · 92%/ }).first(),
  ).toHaveAttribute("href", "https://www.bbc.com/news/");
  await expect(page.getByRole("link", { name: /ERC-8004 resolver #7/ })).toHaveAttribute(
    "href",
    "/api/agent-card",
  );
});

test("shows complete won lost void and ongoing portfolio states", async ({ page }) => {
  await page.getByRole("button", { name: "Connect" }).click();
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Positions, without the guesswork." }),
  ).toBeVisible();
  await expect(page.getByText("Settled P&L")).toBeVisible();
  await expect(page.getByText("0.0290 MON")).toBeVisible();
  await expect(page.locator('[data-status="won"]')).toBeVisible();
  await expect(page.locator('[data-status="lost"]')).toBeVisible();
  await expect(page.locator('[data-status="void"]')).toBeVisible();
  await expect(page.locator('[data-status="ongoing"]').first()).toBeVisible();

  await page.getByRole("button", { name: "won", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Global trade report clears its final vote",
    }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("connects test wallet and places exactly one position", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Shared chain mutation runs once.");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("button", { name: /0xf39…2266/i })).toBeVisible();

  await page.getByRole("button", { name: /YES 0.01 MON/ }).click();
  await page.getByRole("button", { name: "Lock YES" }).click();
  await expect(page.getByText("Transaction confirmed.")).toBeVisible();
  await expect(page.getByText("POSITION LOCKED · YES")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock YES" })).toHaveCount(0);
});

test("ships an installable PWA shell", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.name).toContain("THEYA");
  expect(body.display).toBe("standalone");
  expect(body.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
});

test("rejects unauthenticated agent execution", async ({ request }) => {
  expect((await request.get("/api/agent/create")).status()).toBe(401);
  expect((await request.get("/api/agent/resolve")).status()).toBe(401);
});

test("advertises ERC-8004 identity and x402 payment", async ({ request }) => {
  const card = await request.get("/api/agent-card");
  expect(card.ok()).toBe(true);
  const registration = await card.json();
  expect(registration.type).toContain("eip-8004");
  expect(registration.name).toBe("THEYA Evidence Resolver");
  expect(registration.x402Support).toBe(true);
  expect(registration.registrations[0].agentId).toBe(7);

  const payment = await request.get("/api/oracle/audit?marketId=1");
  expect(payment.status()).toBe(402);
  expect(payment.headers()["payment-required"]).toBeTruthy();
});

test("closes articles at the next midnight IST", () => {
  expect(articleCloseAtIst("2026-08-29T00:00:00.000Z")).toBe(
    Date.parse("2026-08-29T18:30:00.000Z") / 1_000,
  );
  expect(articleCloseAtIst("2026-08-29T20:00:00.000Z")).toBe(
    Date.parse("2026-08-30T18:30:00.000Z") / 1_000,
  );
  expect(articleCloseAtIst("not-a-date")).toBe(0);
});
