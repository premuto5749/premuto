"""E2E 테스트: 약 기록 수정 시 이름/복용량/단위 분리 편집 (#295)."""

import time
import re
from playwright.sync_api import Page, expect


def _create_medicine_log(page: Page, base_url: str, medicine_name: str = "테스트약 500mg"):
    """테스트용 약 기록을 API로 직접 생성하고 페이지를 새로고침."""
    import json as _json
    # 한글 이름을 JS에 안전하게 전달하기 위해 JSON으로 이스케이프
    safe_name = _json.dumps(medicine_name, ensure_ascii=False)
    result = page.evaluate(f"""
        async () => {{
            const now = new Date();
            const res = await fetch('/api/daily-logs', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{
                    category: 'medicine',
                    amount: 1,
                    medicine_name: {safe_name},
                    input_source: 'manual',
                    logged_at: now.toISOString()
                }})
            }});
            const text = await res.text();
            let data = null;
            try {{ data = JSON.parse(text); }} catch(e) {{}}
            return {{ status: res.status, id: data?.data?.id || data?.id || null, body: text.substring(0, 200) }};
        }}
    """)
    assert result["status"] in (200, 201), f"Failed to create medicine log: status={result['status']}, body={result.get('body', '')}"
    page.reload()
    page.wait_for_load_state("networkidle")
    return result.get("id")


def _open_medicine_detail(page: Page):
    """타임라인에서 약(💊) 기록 카드를 클릭하여 상세 모달을 연다."""
    # 💊 아이콘이 있는 카드를 찾아서 클릭
    medicine_card = page.locator("text=💊").first
    medicine_card.click()
    # 모달이 열릴 때까지 대기
    page.wait_for_selector("[role='dialog']", timeout=5000)


def _start_editing(page: Page):
    """상세 모달에서 수정 버튼(Edit2 아이콘)을 클릭."""
    edit_btn = page.locator("[role='dialog'] button").filter(has=page.locator("svg.lucide-pencil, svg.lucide-edit-2, svg.lucide-square-pen"))
    if edit_btn.count() == 0:
        # fallback: 텍스트로 찾기
        edit_btn = page.locator("[role='dialog'] button:has-text('수정')")
    edit_btn.first.click()
    page.wait_for_timeout(500)


def _cleanup_log(page: Page, log_id: str):
    """테스트 데이터 정리: 생성한 기록 삭제."""
    if log_id:
        page.evaluate(f"""
            async () => {{
                await fetch('/api/daily-logs?id={log_id}', {{ method: 'DELETE' }});
            }}
        """)


# ─── 시나리오 1: 수동 입력 약 기록 → 이름/복용량/단위 분리 편집 후 저장 ───


def test_manual_medicine_edit_separated_fields(authenticated_page):
    """수동 입력 약 기록을 수정할 때 이름/복용량/단위 3개 필드로 분리되는지 확인."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "타이레놀 500mg")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # "직접 입력" 탭이 선택된 상태인지 확인
        manual_tab = page.locator("[role='dialog'] [role='tab']:has-text('직접 입력')")
        expect(manual_tab).to_have_attribute("data-state", "active")

        # 약 이름 필드에 "타이레놀"이 파싱되어 있는지
        medicine_input = page.locator("#edit-medicine")
        expect(medicine_input).to_have_value("타이레놀")

        # 복용량 필드에 "500"이 있는지
        dosage_input = page.locator("[role='dialog'] input[type='number'][placeholder='복용량']")
        expect(dosage_input).to_have_value("500")

        # 단위 select에서 "mg"가 선택되어 있는지
        unit_select = page.locator("[role='dialog'] select")
        expect(unit_select).to_have_value("mg")

        # 값 변경: 아목시실린 250mg
        medicine_input.fill("아목시실린")
        dosage_input.fill("250")

        # API 응답 캡처
        with page.expect_response(lambda r: "/api/daily-logs" in r.url and r.request.method == "PATCH") as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        response = resp_info.value
        assert response.status == 200

        # 모달이 보기 모드로 전환됨
        page.wait_for_timeout(500)

        # 타임라인에서 업데이트된 약 이름 확인
        expect(page.locator("text=아목시실린 250mg").first).to_be_visible(timeout=5000)

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 2: 복용량 없이 약 이름만 저장 ───


def test_medicine_edit_name_only(authenticated_page):
    """복용량 없이 약 이름만 있는 기록의 편집 및 저장."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "소화제")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # 약 이름 = "소화제", 복용량 = 빈 값
        medicine_input = page.locator("#edit-medicine")
        expect(medicine_input).to_have_value("소화제")

        dosage_input = page.locator("[role='dialog'] input[type='number'][placeholder='복용량']")
        expect(dosage_input).to_have_value("")

        # 이름만 변경
        medicine_input.fill("정장제")

        with page.expect_response(lambda r: "/api/daily-logs" in r.url and r.request.method == "PATCH") as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        assert resp_info.value.status == 200
        page.wait_for_timeout(500)

        # "정장제"만 표시 (복용량 없음)
        expect(page.locator("text=정장제").first).to_be_visible(timeout=5000)

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 3: 프리셋 탭 전환 시 UI 표시 확인 ───


def test_medicine_edit_preset_tab(authenticated_page):
    """수정 모드에서 프리셋/직접입력 탭 전환이 동작하는지 확인."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "테스트약 100mg")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # 프리셋 선택 탭 클릭
        preset_tab = page.locator("[role='dialog'] [role='tab']:has-text('프리셋 선택')")
        preset_tab.click()
        page.wait_for_timeout(500)

        # 프리셋 목록 또는 "등록된 프리셋이 없습니다" 메시지 확인
        dialog = page.locator("[role='dialog']")
        has_presets = dialog.locator("button.rounded-lg.border-2").count() > 0
        has_empty_msg = dialog.locator("text=등록된 프리셋이 없습니다").count() > 0

        assert has_presets or has_empty_msg, "프리셋 목록 또는 안내 메시지가 표시되어야 합니다"

        if has_empty_msg:
            # "간식/약 관리" 링크 존재 확인
            manage_link = dialog.locator("a[href='/manage']")
            expect(manage_link).to_be_visible()

        # 다시 직접 입력 탭으로 전환
        manual_tab = page.locator("[role='dialog'] [role='tab']:has-text('직접 입력')")
        manual_tab.click()
        page.wait_for_timeout(300)

        # 직접 입력 필드가 다시 표시됨
        expect(page.locator("#edit-medicine")).to_be_visible()

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 4: 수정 취소 시 원래 값 복원 ───


def test_medicine_edit_cancel_restores(authenticated_page):
    """수정 중 취소하면 원래 약 이름이 복원되는지 확인."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "타이레놀 500mg")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # 값 변경
        page.locator("#edit-medicine").fill("변경된약")
        page.locator("[role='dialog'] input[type='number'][placeholder='복용량']").fill("999")

        # 취소 클릭
        page.locator("[role='dialog'] button:has-text('취소')").click()
        page.wait_for_timeout(500)

        # 보기 모드에서 원래 값("타이레놀 500mg") 확인
        dialog = page.locator("[role='dialog']")
        expect(dialog.locator("text=타이레놀 500mg")).to_be_visible()

        # "변경된약"이 표시되지 않는지 확인
        expect(dialog.locator("text=변경된약")).to_have_count(0)

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 5: 수정 중 모달 닫힘 방지 (ESC 키) ───


def test_medicine_edit_modal_no_close_on_escape(authenticated_page):
    """수정 모드에서 ESC 키를 눌러도 모달이 닫히지 않는지 확인."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "비타민 1정")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # ESC 키 누르기
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 모달이 여전히 열려 있는지
        expect(page.locator("[role='dialog']")).to_be_visible()
        # 수정 모드 유지 (저장/취소 버튼이 보이는지)
        expect(page.locator("[role='dialog'] button:has-text('저장')")).to_be_visible()

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 6: 단위만 변경 ───


def test_medicine_edit_change_unit_only(authenticated_page):
    """약 이름과 복용량은 유지하고 단위만 변경."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "항생제 500mg")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # 이름/복용량 확인
        expect(page.locator("#edit-medicine")).to_have_value("항생제")
        expect(page.locator("[role='dialog'] input[type='number'][placeholder='복용량']")).to_have_value("500")

        # 단위를 mg → 캡슐로 변경
        page.locator("[role='dialog'] select").select_option("캡슐")

        with page.expect_response(lambda r: "/api/daily-logs" in r.url and r.request.method == "PATCH") as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        assert resp_info.value.status == 200
        page.wait_for_timeout(500)

        # 타임라인에서 "항생제 500캡슐" 확인
        expect(page.locator("text=항생제 500캡슐").first).to_be_visible(timeout=5000)

    finally:
        _cleanup_log(page, log_id)


# ─── 시나리오 7: 소수점 복용량 ───


def test_medicine_edit_decimal_dosage(authenticated_page):
    """소수점 복용량(0.5정) 입력 및 저장."""
    page = authenticated_page
    log_id = _create_medicine_log(page, "", "이부프로펜")

    try:
        _open_medicine_detail(page)
        _start_editing(page)

        # 약 이름 확인 (복용량 없는 fallback)
        expect(page.locator("#edit-medicine")).to_have_value("이부프로펜")

        # 소수점 복용량 입력
        page.locator("[role='dialog'] input[type='number'][placeholder='복용량']").fill("0.5")
        page.locator("[role='dialog'] select").select_option("정")

        with page.expect_response(lambda r: "/api/daily-logs" in r.url and r.request.method == "PATCH") as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        assert resp_info.value.status == 200
        page.wait_for_timeout(500)

        # "이부프로펜 0.5정" 표시 확인
        expect(page.locator("text=이부프로펜 0.5정").first).to_be_visible(timeout=5000)

    finally:
        _cleanup_log(page, log_id)
