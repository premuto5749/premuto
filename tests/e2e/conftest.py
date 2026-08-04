"""E2E 테스트 공통 픽스처 (sync Playwright)."""

import os
import pytest
from pathlib import Path


BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")
# Supabase Auth 테스트 계정
E2E_EMAIL = os.getenv("E2E_EMAIL", "")
E2E_PASSWORD = os.getenv("E2E_PASSWORD", "")
SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def authenticated_page(page):
    """Supabase Auth로 로그인된 페이지 반환."""
    if not E2E_EMAIL or not E2E_PASSWORD:
        pytest.skip("E2E_EMAIL / E2E_PASSWORD 환경변수가 설정되지 않았습니다")

    page.goto(f"{BASE_URL}/login")
    # "이메일로 로그인" 버튼 클릭하여 이메일 폼 표시
    email_login_btn = page.locator("button:has-text('이메일로')")
    email_login_btn.wait_for(timeout=10000)
    email_login_btn.click()
    # 이메일/비밀번호 입력
    page.wait_for_selector("input[type='email']", timeout=10000)
    page.fill("input[type='email']", E2E_EMAIL)
    page.fill("input[type='password']", E2E_PASSWORD)
    page.click("button[type='submit']")
    # 로그인 후 리다이렉트 대기 — /login 페이지를 벗어나면 성공
    page.wait_for_function(
        "() => !window.location.pathname.startsWith('/login')",
        timeout=20000
    )
    return page


@pytest.fixture(autouse=True)
def screenshot_on_failure(page, request):
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
