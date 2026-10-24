import { expect, test } from '@playwright/test';
async function openFixture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'battery-study' }) })
    .click();
  await expect(page.getByRole('heading', { name: '电池寿命研究' })).toBeVisible();
}

test('lists real projects, searches, and opens a research report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'battery-study' })).toBeVisible();
  await page.getByPlaceholder('搜索项目或研究目标').fill('不存在的研究');
  await expect(page.getByText('没有匹配的项目')).toBeVisible();
  await page.getByPlaceholder('搜索项目或研究目标').fill('电池');
  await page.locator('a.project-card').click();
  await expect(page.getByRole('heading', { name: '电池寿命研究' })).toBeVisible();
  await page.getByRole('button', { name: '查看问题并回答' }).click();
  await expect(page.getByText('优先研究哪一个泛化问题？')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.screenshot({ path: 'artifacts/workbench-tested.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('creates a project with a separate research directory', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建研究项目' }).click();
  await page.getByLabel('项目名称').fill('浏览器新建项目');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '浏览器新建项目' })).toBeVisible();
  await page.getByRole('button', { name: '启动研究' }).click();
  await expect(page.getByLabel('研究目标')).toBeVisible();
  await page.getByRole('button', { name: /取\s*消/ }).click();
});

test('edits and saves a report through the API', async ({ page }) => {
  await openFixture(page);
  await page.getByText('编辑', { exact: true }).click();
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n\n浏览器保存验证。');
  await expect(page.getByText('有未保存的修改，请在切换文件或页面前保存。')).toBeVisible();
  await page.locator('.back-link').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /取\s*消/ }).click();
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('浏览器保存验证。', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('浏览器保存验证。', { exact: true })).toBeVisible();
});

test('expert review submits explicit feedback with a version token', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: '查看问题并回答' }).click();
  let body: Record<string, unknown> | undefined;
  await page.route('**/api/projects/*/runs', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'mock-run' }),
    });
  });
  await page
    .getByPlaceholder('输入你的回答或修改意见；留空表示接受当前产物并继续。')
    .fill('优先研究跨电芯泛化');
  await page.getByRole('button', { name: '提交意见并继续' }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect.poll(() => body?.answer).toBe('优先研究跨电芯泛化');
  expect(body?.action).toBe('review');
  expect(typeof body?.checkpoint_token).toBe('string');
});

test('mobile workbench fits the viewport and file navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('tab', { name: /项目文件/ }).click();
  await page.getByRole('button', { name: 'literature/RESEARCH_REPORT.md' }).click();
  await expect(page.getByRole('heading', { name: '电池寿命研究' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/workbench-mobile-tested.png', fullPage: true });
});

test('connection errors provide a retry action', async ({ page }) => {
  await page.route('**/api/projects', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: '服务暂不可用' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByText('项目加载失败')).toBeVisible();
  await expect(page.getByText('服务暂不可用')).toBeVisible();
  await expect(page.getByRole('button', { name: /重\s*试/ })).toBeVisible();
});

test('login gates project data and logout returns to login', async ({ page }) => {
  let signedIn = false;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { enabled: true, authenticated: signedIn } }),
  );
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON();
    signedIn = body.username === 'admin' && body.password === 'correct-password';
    await route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { authenticated: true } : { detail: '用户名或密码错误' },
    });
  });
  await page.route('**/api/auth/logout', async (route) => {
    signedIn = false;
    await route.fulfill({ json: { authenticated: false } });
  });
  await page.goto('/');
  await expect(page.getByText('登录你的研究空间')).toBeVisible();
  await expect(page.locator('a.project-card')).toHaveCount(0);
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByText('用户名或密码错误')).toBeVisible();
  await page.getByLabel('密码', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByRole('heading', { name: 'battery-study' })).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByText('登录你的研究空间')).toBeVisible();
  await expect(page.locator('a.project-card')).toHaveCount(0);
});

test('expert questions have a visible entry and collaboration mode can be chosen', async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole('button', { name: '查看问题并回答' }).click();
  await expect(
    page.getByPlaceholder('输入你的回答或修改意见；留空表示接受当前产物并继续。'),
  ).toBeInViewport();
  await page.goto('/');
  await page.getByRole('button', { name: '新建研究项目' }).click();
  await page.getByLabel('项目名称').fill('模式选择测试');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('button', { name: '协作方式设置' }).click();
  await expect(page.getByLabel('协作方式')).toBeVisible();
  await expect(page.getByText('专家模式 · 每个阶段审阅后继续（推荐）')).toBeVisible();
});

test('LaTeX source and PDF appear together and images open in a gallery', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('tab', { name: /项目文件/ }).click();
  await page.getByRole('button', { name: /paper\/main\.tex/ }).click();
  await expect(page.getByText('LaTeX 论文工作区', { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="论文 PDF 对照预览"]')).toBeVisible();
  await page.getByText('编辑', { exact: true }).click();
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n% Browser edit');
  await page.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('文件已保存')).toBeVisible();
  await expect(
    page.getByText('源码已修改，右侧 PDF 可能尚未更新，需重新编译后核对。'),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/latex-workspace.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('tab', { name: '图片画廊' }).click();
  await page.locator('.figure-gallery .ant-image').first().click();
  await expect(page.locator('.ant-image-preview')).toBeVisible();
});

for (const viewport of [
  { width: 1512, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`file contents scroll without moving controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/projects/*/file?*', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      const path = new URL(route.request().url()).searchParams.get('path');
      await route.fulfill({
        response,
        json: {
          ...data,
          content: path?.endsWith('.tex')
            ? '\\documentclass{article}\n' + '% Long source line\n'.repeat(250)
            : '# 电池寿命研究\n\n' + '研究证据与实验结果。\n\n'.repeat(250),
        },
      });
    });
    await openFixture(page);
    const content = page.locator('.artifact-content');
    const toolbar = page.locator('.artifact-toolbar');
    const top = (await toolbar.boundingBox())!.y;
    await expect.poll(() => content.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await content.hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect((await toolbar.boundingBox())!.y).toBe(top);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
    await page.getByRole('button', { name: '全屏查看' }).click();
    await expect(page.locator('.artifact-expanded')).toBeVisible();
    await page.getByRole('button', { name: '退出全屏' }).click();
    await page.getByRole('tab', { name: /项目文件/ }).click();
    await page.getByRole('button', { name: 'paper/main.tex', exact: true }).click();
    const source = page.locator('.latex-source .source-preview');
    await expect.poll(() => source.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const sourceTop = (await toolbar.boundingBox())!.y;
    await source.hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(() => source.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect((await toolbar.boundingBox())!.y).toBe(sourceTop);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (viewport.width < 700) {
      await page.locator('.latex-mobile-switch').getByText('PDF 预览', { exact: true }).click();
      await expect(page.locator('.latex-pdf iframe')).toBeVisible();
      await expect(source).toBeHidden();
    }
    await page.getByRole('button', { name: /运行动态/ }).click();
    await expect(page.getByRole('dialog', { name: '运行动态' })).toBeVisible();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/bounded-workbench-${viewport.width}.png` });
  });
}
