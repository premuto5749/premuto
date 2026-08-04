"""E2E 테스트 공통 픽스처 (sync Playwright)."""

import os
import pytest
from pathlib import Path
from playwright.sync_api import Page, expect


BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")
E2E_EMAIL = os.getenv("E2E_EMAIL", "premuto.min@gmail.com")
E2E_PASSWORD = os.getenv("E2E_PASSWORD", "Cloud0622!")
SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def authenticated_page(page: Page):
    """Supabase Auth 로그인 후 /daily-log 페이지까지 이동한 page를 반환."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")

    # "또는 이메일로 로그인" 버튼 클릭하여 이메일 폼 열기
    email_toggle = page.locator("button:has-text('이메일로')")
    if email_toggle.count() > 0:
        email_toggle.first.click()
        page.wait_for_timeout(500)

    # 이메일/비밀번호 입력
    page.fill("input[type='email']", E2E_EMAIL)
    page.fill("input[type='password']", E2E_PASSWORD)

    # 로그인 버튼 클릭
    page.click("button[type='submit']")

    # 로그인 후 리다이렉트 대기 (최대 15초)
    page.wait_for_url(f"{BASE_URL}/**", timeout=15000)
    page.wait_for_load_state("networkidle")

    # daily-log 페이지가 아니면 이동
    if "/daily-log" not in page.url:
        page.goto(f"{BASE_URL}/daily-log")
        page.wait_for_load_state("networkidle")

    return page


@pytest.fixture(autouse=True)
def screenshot_on_failure(page: Page, request):
    """테스트 실패시 스크린샷 자동 저장."""
    yield
    rep = getattr(request.node, "rep_call", None)
    if rep is not None and rep.failed:
        SCREENSHOTS_DIR.mkdir(exist_ok=True)
        name = request.node.nodeid.replace("/", "_").replace("::", "_").replace("\\", "_")
        page.screenshot(path=str(SCREENSHOTS_DIR / f"{name}.png"))


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)
