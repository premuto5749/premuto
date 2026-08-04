"""진료 녹음 기록 기능 E2E 테스트.

테스트 대상: /vet-visits 페이지
- 페이지 접근 및 빈 상태 표시
- 녹음 분석 업로드 다이얼로그
- 면책 동의 체크박스 동작
- 진료 기록 CRUD
- 사이드바 메뉴 노출
"""

import time
from playwright.sync_api import Page, expect


def test_vet_visits_page_loads(authenticated_page: Page, base_url: str):
    """진료 기록 페이지가 정상 로드된다."""
    authenticated_page.goto(f"{base_url}/vet-visits")
    authenticated_page.wait_for_load_state("networkidle")

    # 페이지 타이틀 확인
    heading = authenticated_page.locator("h1:has-text('진료 기록')")
    expect(heading).to_be_visible(timeout=10000)


def test_empty_state_displayed(authenticated_page: Page, base_url: str):
    """진료 기록이 없을 때 빈 상태 메시지가 표시된다."""
    authenticated_page.goto(f"{base_url}/vet-visits")
    authenticated_page.wait_for_load_state("networkidle")

    empty_msg = authenticated_page.locator("text=아직 진료 기록이 없습니다")
    expect(empty_msg).to_be_visible(timeout=10000)


def test_upload_dialog_opens(authenticated_page: Page, base_url: str):
    """녹음 분석 버튼 클릭 시 업로드 다이얼로그가 열린다."""
    authenticated_page.goto(f"{base_url}/vet-visits")
    authenticated_page.wait_for_load_state("networkidle")

    # 녹음 분석 버튼 클릭
    upload_btn = authenticated_page.locator("button:has-text('녹음 분석')")
    expect(upload_btn).to_be_visible(timeout=10000)
    upload_btn.click()

    # 다이얼로그 내 면책 동의 텍스트 확인
    consent_text = authenticated_page.locator("text=적법한 녹음만 업로드합니다")
    expect(consent_text).to_be_visible(timeout=5000)


def test_consent_checkbox_disables_upload(authenticated_page: Page, base_url: str):
    """면책 동의 미체크 시 업로드 버튼이 비활성화된다."""
    authenticated_page.goto(f"{base_url}/vet-visits")
    authenticated_page.wait_for_load_state("networkidle")

    authenticated_page.locator("button:has-text('녹음 분석')").click()

    # 업로드 버튼은 비활성화 상태
    submit_btn = authenticated_page.locator("button:has-text('업로드 및 분석')")
    expect(submit_btn).to_be_visible(timeout=5000)
    expect(submit_btn).to_be_disabled()

    # 체크박스 클릭
    authenticated_page.locator("#consent").click()

    # 파일 선택 전이라 여전히 비활성화 (file 없으므로)
    expect(submit_btn).to_be_disabled()


def test_consent_checkbox_enables_with_file(authenticated_page: Page, base_url: str):
    """면책 동의 + 파일 선택 시 업로드 버튼이 활성화된다."""
    authenticated_page.goto(f"{base_url}/vet-visits")
    authenticated_page.wait_for_load_state("networkidle")

    authenticated_page.locator("button:has-text('녹음 분석')").click()
    authenticated_page.wait_for_selector("text=적법한 녹음만 업로드합니다", timeout=5000)

    # 동의 체크
    authenticated_page.locator("#consent").click()

    # 짧은 테스트용 오디오 파일 생성 (빈 wav 헤더)
    authenticated_page.locator("input[type='file']").set_input_files(
        {
            "name": "test_audio.mp3",
            "mimeType": "audio/mpeg",
            "buffer": b"\xff\xfb\x90\x00" + b"\x00" * 1024,  # minimal mp3 frame
        }
    )

    # 파일 선택 후 버튼 활성화
    submit_btn = authenticated_page.locator("button:has-text('업로드 및 분석')")
    expect(submit_btn).to_be_enabled(timeout=3000)


def test_sidebar_has_vet_visits_link(authenticated_page: Page, base_url: str):
    """사이드바에 진료 기록 메뉴가 있다."""
    authenticated_page.goto(f"{base_url}/daily-log")
    authenticated_page.wait_for_load_state("networkidle")

    # 모바일이면 햄버거 메뉴 열기
    menu_btn = authenticated_page.locator("button:has(svg.lucide-menu)").first
    if menu_btn.is_visible():
        menu_btn.click()
        authenticated_page.wait_for_timeout(300)

    vet_link = authenticated_page.locator("a[href='/vet-visits']")
    expect(vet_link).to_be_visible(timeout=5000)
    expect(vet_link).to_have_text("진료 기록")


def test_manual_vet_visit_create(authenticated_page: Page, base_url: str):
    """녹음 없이 수동으로 진료 기록을 생성할 수 있다 (API 직접 호출)."""
    page = authenticated_page
    today = time.strftime("%Y-%m-%d")

    # API로 직접 진료기록 생성
    page.goto(f"{base_url}/vet-visits")
    page.wait_for_load_state("networkidle")

    # 현재 pet_id 가져오기
    pet_id = page.evaluate("""() => {
        const stored = localStorage.getItem('selectedPetId')
        return stored || null
    }""")

    if not pet_id:
        # pet 선택이 안 되어 있으면 건너뜀
        pytest.skip("선택된 반려동물이 없습니다")

    # API로 직접 생성
    response = page.evaluate(f"""async () => {{
        const res = await fetch('/api/vet-visits', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{
                pet_id: '{pet_id}',
                visit_date: '{today}',
                hospital_name: 'E2E 테스트 동물병원',
                diagnosis: ['테스트 진단'],
                prescriptions: [{{drug_name: '테스트약', dosage: '1mg', frequency: '1일1회', duration: '3일'}}],
                vet_instructions: 'E2E 테스트 지시사항',
                cost: 50000
            }})
        }});
        return {{ status: res.status, data: await res.json() }};
    }}""")

    assert response["status"] == 201, f"생성 실패: {response}"
    record_id = response["data"]["data"]["id"]

    # 페이지 새로고침 후 카드 확인
    page.reload()
    page.wait_for_load_state("networkidle")

    card = page.locator(f"text=E2E 테스트 동물병원")
    expect(card).to_be_visible(timeout=10000)

    # 정리: 삭제
    page.evaluate(f"""async () => {{
        await fetch('/api/vet-visits?id={record_id}', {{ method: 'DELETE' }});
    }}""")


def test_daily_log_vet_visit_banner(authenticated_page: Page, base_url: str):
    """일일기록 페이지에서 동일 날짜 진료기록이 있으면 배너가 표시된다."""
    page = authenticated_page
    today = time.strftime("%Y-%m-%d")

    page.goto(f"{base_url}/vet-visits")
    page.wait_for_load_state("networkidle")

    pet_id = page.evaluate("() => localStorage.getItem('selectedPetId')")
    if not pet_id:
        pytest.skip("선택된 반려동물이 없습니다")

    # 오늘 날짜로 진료기록 생성
    response = page.evaluate(f"""async () => {{
        const res = await fetch('/api/vet-visits', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{
                pet_id: '{pet_id}',
                visit_date: '{today}',
                hospital_name: 'E2E 배너 테스트',
                diagnosis: ['배너테스트']
            }})
        }});
        return await res.json();
    }}""")
    record_id = response["data"]["id"]

    # 일일기록 페이지로 이동
    page.goto(f"{base_url}/daily-log")
    page.wait_for_load_state("networkidle")

    # 배너 확인
    banner = page.locator("text=진료 기록이 있습니다")
    expect(banner).to_be_visible(timeout=10000)

    # 정리
    page.evaluate(f"""async () => {{
        await fetch('/api/vet-visits?id={record_id}', {{ method: 'DELETE' }});
    }}""")
