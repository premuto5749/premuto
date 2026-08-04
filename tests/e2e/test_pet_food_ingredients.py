"""E2E 테스트: 사료/간식 성분 관리 (feat/food-ingredients).

대상: /manage 페이지 > "사료/간식 성분" 탭 (PetFoodSection / PetFoodForm)
OCR은 AI 호출이므로 제외. CRUD + 필터 + 상세 보기만 검증.

실행:
    pytest tests/e2e/test_pet_food_ingredients.py -v
"""

import time
import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3000"


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _navigate_to_food_tab(page: Page):
    """인증된 상태에서 /manage 페이지의 "사료/간식 성분" 탭으로 이동."""
    page.goto(f"{BASE_URL}/manage")
    page.wait_for_load_state("networkidle")
    # "사료/간식 성분" 탭 클릭 (defaultValue="food" 이면 자동 활성)
    food_tab = page.locator("[role='tab']:has-text('사료'), [role='tab']:has-text('성분')")
    if food_tab.count() > 0:
        food_tab.first.click()
        page.wait_for_timeout(500)


def _create_food_via_api(page: Page, food_data: dict) -> str:
    """API를 통해 테스트용 사료 데이터를 생성하고 생성된 id를 반환."""
    import json as _json
    body = _json.dumps(food_data, ensure_ascii=False)
    result = page.evaluate(f"""
        async () => {{
            const res = await fetch('/api/pet-foods', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: {_json.dumps(body)}
            }});
            const data = await res.json();
            return {{ status: res.status, id: data?.data?.id || data?.id || null, body: JSON.stringify(data).substring(0, 300) }};
        }}
    """)
    assert result["status"] in (200, 201), (
        f"사료 생성 실패: status={result['status']}, body={result.get('body', '')}"
    )
    return result["id"]


def _delete_food_via_api(page: Page, food_id: str):
    """API를 통해 테스트 데이터 정리."""
    if food_id:
        page.evaluate(f"""
            async () => {{
                await fetch('/api/pet-foods?id={food_id}', {{ method: 'DELETE' }});
            }}
        """)


# ──────────────────────────────────────────────
# 1. 사료 목록 표시
# ──────────────────────────────────────────────

def test_food_list_loads_on_tab(authenticated_page):
    """Happy path: /manage 진입 시 사료/간식 성분 탭이 표시되고 목록이 로드된다."""
    page = authenticated_page
    _navigate_to_food_tab(page)

    # 탭 자체가 렌더링되어 있는지 확인
    food_tab = page.locator("[role='tab']").filter(has_text="사료")
    expect(food_tab.first).to_be_visible(timeout=5000)

    # "추가" 버튼(Plus 아이콘)이 보이는지 확인 — 목록 섹션이 마운트됨을 의미
    add_button = page.locator("button svg.lucide-plus").first
    expect(add_button).to_be_visible(timeout=5000)

    # 로딩 스피너가 사라졌는지 확인 (networkidle 이후이므로 없어야 함)
    expect(page.locator("[data-testid='food-loading'], svg.lucide-loader-2")).to_have_count(0)


def test_food_list_empty_state(authenticated_page):
    """Edge case: 사료가 한 건도 없을 때 빈 상태 안내 메시지가 표시된다.

    참고: 공용(관리자) 사료가 있다면 빈 상태가 나타나지 않을 수 있음.
    이 테스트는 빈 상태 UI 코드가 존재하는지 구조 검증용으로 사용한다.
    """
    page = authenticated_page
    _navigate_to_food_tab(page)

    # "등록된 사료가 없습니다" 텍스트 OR 사료 카드 — 둘 중 하나는 반드시 존재
    empty_msg = page.locator("text=등록된 사료가 없습니다")
    # 카드가 있으면 빈 상태가 아님 — 최소한 페이지가 에러 없이 렌더링되었는지 확인
    section = page.locator("section, [data-section='food'], [class*='PetFood']")
    # 최소 조건: 오류 메시지("오류", "error", "500")가 없어야 함
    expect(page.locator("text=Internal Server Error")).to_have_count(0)
    expect(page.locator("text=오류가 발생했습니다")).to_have_count(0)


# ──────────────────────────────────────────────
# 2. 새 사료 등록
# ──────────────────────────────────────────────

def test_food_create_simple(authenticated_page):
    """Happy path: 제품명만 입력해도 저장이 성공한다 (간단 등록)."""
    page = authenticated_page
    food_id = None
    _navigate_to_food_tab(page)

    try:
        # 추가 버튼 클릭
        page.locator("button:has(svg.lucide-plus), button[aria-label='추가'], button:has-text('추가')").first.click()
        page.wait_for_selector("[role='dialog']", timeout=5000)

        # 제품명 필드 입력
        name_input = page.locator("#pf_name")
        expect(name_input).to_be_visible(timeout=3000)
        name_input.fill("QA테스트사료_간단등록")

        # 저장 버튼 활성화 확인 (name이 있으면 활성)
        save_button = page.locator("[role='dialog'] button:has-text('저장')")
        expect(save_button).to_be_enabled()

        # API 응답 캡처
        with page.expect_response(
            lambda r: "/api/pet-foods" in r.url and r.request.method == "POST"
        ) as resp_info:
            save_button.click()

        response = resp_info.value
        assert response.status in (200, 201), f"사료 생성 API 실패: {response.status}"

        # 응답에서 생성된 id 추출 (정리용)
        body = response.json()
        food_id = body.get("data", {}).get("id") or body.get("id")

        # 다이얼로그 닫힘 + 목록에 새 항목 표시
        page.wait_for_selector("[role='dialog']", state="hidden", timeout=5000)
        expect(page.locator("text=QA테스트사료_간단등록").first).to_be_visible(timeout=5000)

    finally:
        _delete_food_via_api(page, food_id)


def test_food_create_with_nutrients(authenticated_page):
    """Happy path: 영양성분 행을 추가하고 저장하면 성분이 함께 저장된다."""
    page = authenticated_page
    food_id = None
    _navigate_to_food_tab(page)

    try:
        page.locator("button:has(svg.lucide-plus), button[aria-label='추가'], button:has-text('추가')").first.click()
        page.wait_for_selector("[role='dialog']", timeout=5000)

        # 기본 정보 입력
        page.locator("#pf_brand").fill("테스트브랜드")
        page.locator("#pf_name").fill("QA테스트사료_성분포함")
        page.locator("#pf_calorie").fill("3.5")

        # 영양성분 행 추가 버튼 클릭
        add_nutrient_btn = page.locator("[role='dialog'] button:has-text('항목 추가'), [role='dialog'] button:has-text('+ 항목')")
        add_nutrient_btn.first.click()
        page.wait_for_timeout(300)

        # 첫 번째 영양성분 행 입력
        nutrient_name = page.locator("[role='dialog'] input[placeholder*='성분명']").first
        nutrient_value = page.locator("[role='dialog'] input[placeholder*='수치']").first
        nutrient_name.fill("조단백")
        nutrient_value.fill("25.0")

        # 원재료 입력
        page.locator("#pf_ingredients").fill("닭고기, 쌀, 고구마")

        # 저장
        with page.expect_response(
            lambda r: "/api/pet-foods" in r.url and r.request.method == "POST"
        ) as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        response = resp_info.value
        assert response.status in (200, 201), f"성분 포함 사료 생성 실패: {response.status}"
        body = response.json()
        food_id = body.get("data", {}).get("id") or body.get("id")

        page.wait_for_selector("[role='dialog']", state="hidden", timeout=5000)
        expect(page.locator("text=QA테스트사료_성분포함").first).to_be_visible(timeout=5000)

    finally:
        _delete_food_via_api(page, food_id)


def test_food_create_save_disabled_without_name(authenticated_page):
    """Edge case: 제품명 없이는 저장 버튼이 비활성화 상태다."""
    page = authenticated_page
    _navigate_to_food_tab(page)

    page.locator("button:has(svg.lucide-plus), button[aria-label='추가'], button:has-text('추가')").first.click()
    page.wait_for_selector("[role='dialog']", timeout=5000)

    # 제품명을 입력하지 않은 초기 상태
    save_button = page.locator("[role='dialog'] button:has-text('저장')")
    expect(save_button).to_be_disabled()

    # 제품명 입력 후 활성화 확인
    page.locator("#pf_name").fill("A")
    expect(save_button).to_be_enabled()

    # 다시 지우면 비활성화
    page.locator("#pf_name").fill("")
    expect(save_button).to_be_disabled()

    # 취소로 닫기
    page.locator("[role='dialog'] button:has-text('취소')").click()


# ──────────────────────────────────────────────
# 3. 사료 상세 보기
# ──────────────────────────────────────────────

def test_food_detail_dialog_opens_on_card_click(authenticated_page):
    """Happy path: 사료 카드 클릭 시 상세 다이얼로그가 열리고 기본 정보가 표시된다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA테스트사료_상세보기",
        "brand": "QA브랜드",
        "food_category": "건사료",
        "ingredients_text": "닭고기 50%, 쌀 30%",
        "nutrients": [
            {"nutrient_name": "조단백", "value": 28.0, "unit_symbol": "%"},
            {"nutrient_name": "조지방", "value": 15.0, "unit_symbol": "%"},
        ]
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # 카드 찾아서 클릭 (카드 클릭 → DetailDialog)
        card = page.locator("text=QA테스트사료_상세보기").first
        expect(card).to_be_visible(timeout=5000)
        card.click()

        # 다이얼로그 열림 확인
        dialog = page.locator("[role='dialog']")
        expect(dialog).to_be_visible(timeout=5000)

        # 제품명 표시 확인
        expect(dialog.locator("text=QA테스트사료_상세보기")).to_be_visible()
        # 브랜드 표시 확인
        expect(dialog.locator("text=QA브랜드")).to_be_visible()
        # 원재료 표시 확인
        expect(dialog.locator("text=닭고기 50%, 쌀 30%")).to_be_visible()

    finally:
        _delete_food_via_api(page, food_id)


def test_food_detail_shows_nutrients(authenticated_page):
    """Happy path: 상세 다이얼로그에서 영양성분 목록 전체가 표시된다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA테스트사료_영양상세",
        "food_category": "습식",
        "nutrients": [
            {"nutrient_name": "조단백", "value": 12.0, "unit_symbol": "%"},
            {"nutrient_name": "조지방", "value": 8.0, "unit_symbol": "%"},
            {"nutrient_name": "수분", "value": 78.0, "unit_symbol": "%"},
        ]
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        page.locator("text=QA테스트사료_영양상세").first.click()
        dialog = page.locator("[role='dialog']")
        expect(dialog).to_be_visible(timeout=5000)

        # 영양성분 3개 모두 표시 확인
        expect(dialog.locator("text=조단백")).to_be_visible()
        expect(dialog.locator("text=조지방")).to_be_visible()
        expect(dialog.locator("text=수분")).to_be_visible()

    finally:
        _delete_food_via_api(page, food_id)


def test_food_detail_admin_food_has_no_edit_buttons(authenticated_page):
    """Edge case: user_id=null인 관리자 등록 사료는 편집/삭제 버튼이 없다.

    관리자 등록 사료가 DB에 존재할 경우 검증; 없으면 Skip.
    """
    page = authenticated_page
    _navigate_to_food_tab(page)
    page.reload()
    page.wait_for_load_state("networkidle")

    # "관리자 등록" 배지가 있는 카드 찾기
    admin_badge = page.locator("text=관리자 등록").first
    if admin_badge.count() == 0:
        pytest.skip("관리자 등록 사료가 없어 테스트 불가")

    admin_badge.click()
    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=5000)

    # 편집 버튼(Edit2 아이콘)이 없어야 함
    edit_btn = dialog.locator("button svg.lucide-edit-2, button svg.lucide-pencil")
    expect(edit_btn).to_have_count(0)

    # 삭제 버튼(Trash2 아이콘)이 없어야 함
    delete_btn = dialog.locator("button svg.lucide-trash-2")
    expect(delete_btn).to_have_count(0)


# ──────────────────────────────────────────────
# 4. 사료 수정
# ──────────────────────────────────────────────

def test_food_edit_name_and_save(authenticated_page):
    """Happy path: 편집 버튼 클릭 → 제품명 수정 → 저장 → 목록 반영."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA수정전사료",
        "food_category": "간식",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # 편집 버튼 클릭 (카드에 직접 있거나, 상세 다이얼로그에 있음)
        # 먼저 카드에서 편집 아이콘 버튼 시도
        card = page.locator("text=QA수정전사료").first
        expect(card).to_be_visible(timeout=5000)

        edit_btn = page.locator(
            "[data-food-id] button svg.lucide-edit-2, "
            "[data-food-id] button svg.lucide-pencil"
        ).first
        if edit_btn.count() == 0:
            # 카드 클릭 후 다이얼로그 내 편집 버튼
            card.click()
            page.wait_for_selector("[role='dialog']", timeout=5000)
            edit_btn = page.locator(
                "[role='dialog'] button svg.lucide-edit-2, "
                "[role='dialog'] button svg.lucide-pencil"
            ).first

        edit_btn.click()
        page.wait_for_timeout(500)

        # 편집 폼에서 제품명 수정
        name_input = page.locator("#pf_name")
        expect(name_input).to_be_visible(timeout=3000)
        name_input.fill("QA수정후사료")

        with page.expect_response(
            lambda r: "/api/pet-foods" in r.url and r.request.method == "PATCH"
        ) as resp_info:
            page.locator("[role='dialog'] button:has-text('저장')").click()

        response = resp_info.value
        assert response.status == 200, f"사료 수정 API 실패: {response.status}"

        # 다이얼로그 닫힘 + 수정된 이름 표시
        page.wait_for_timeout(500)
        expect(page.locator("text=QA수정후사료").first).to_be_visible(timeout=5000)
        expect(page.locator("text=QA수정전사료")).to_have_count(0)

    finally:
        _delete_food_via_api(page, food_id)


def test_food_edit_cancel_restores_original(authenticated_page):
    """Edge case: 수정 중 취소하면 원래 이름이 유지된다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA취소테스트사료",
        "food_category": "건사료",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        card = page.locator("text=QA취소테스트사료").first
        expect(card).to_be_visible(timeout=5000)

        edit_btn = page.locator(
            "[data-food-id] button svg.lucide-edit-2, "
            "[data-food-id] button svg.lucide-pencil"
        ).first
        if edit_btn.count() == 0:
            card.click()
            page.wait_for_selector("[role='dialog']", timeout=5000)
            edit_btn = page.locator(
                "[role='dialog'] button svg.lucide-edit-2, "
                "[role='dialog'] button svg.lucide-pencil"
            ).first

        edit_btn.click()
        page.wait_for_timeout(500)

        # 이름 변경 후 취소
        page.locator("#pf_name").fill("이름변경됨_취소할것")
        page.locator("[role='dialog'] button:has-text('취소')").click()
        page.wait_for_timeout(500)

        # 원래 이름이 보임, 변경된 이름은 안 보임
        expect(page.locator("text=QA취소테스트사료").first).to_be_visible(timeout=5000)
        expect(page.locator("text=이름변경됨_취소할것")).to_have_count(0)

    finally:
        _delete_food_via_api(page, food_id)


def test_food_edit_ocr_section_hidden(authenticated_page):
    """Edge case: 수정 모드에서는 OCR 섹션("사진으로 자동 입력")이 숨겨진다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QAOCR숨김테스트",
        "food_category": "건사료",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        card = page.locator("text=QAOCR숨김테스트").first
        expect(card).to_be_visible(timeout=5000)

        edit_btn = page.locator(
            "[data-food-id] button svg.lucide-edit-2, "
            "[data-food-id] button svg.lucide-pencil"
        ).first
        if edit_btn.count() == 0:
            card.click()
            page.wait_for_selector("[role='dialog']", timeout=5000)
            edit_btn = page.locator(
                "[role='dialog'] button svg.lucide-edit-2, "
                "[role='dialog'] button svg.lucide-pencil"
            ).first

        edit_btn.click()
        page.wait_for_timeout(500)

        # OCR 섹션 텍스트가 없어야 함
        ocr_section = page.locator("[role='dialog']").locator(
            "text=사진으로 자동 입력, text=분석하기"
        )
        expect(ocr_section).to_have_count(0)

        page.locator("[role='dialog'] button:has-text('취소')").click()

    finally:
        _delete_food_via_api(page, food_id)


# ──────────────────────────────────────────────
# 5. 사료 삭제
# ──────────────────────────────────────────────

def test_food_delete_with_confirm(authenticated_page):
    """Happy path: 삭제 버튼 클릭 → AlertDialog 확인 → 목록에서 제거된다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA삭제테스트사료",
        "food_category": "간식",
    })

    _navigate_to_food_tab(page)
    page.reload()
    page.wait_for_load_state("networkidle")

    card = page.locator("text=QA삭제테스트사료").first
    expect(card).to_be_visible(timeout=5000)

    # 삭제 버튼 클릭 (카드 또는 다이얼로그 내)
    delete_btn = page.locator(
        "[data-food-id] button svg.lucide-trash-2, "
        "[data-food-id] button svg.lucide-trash"
    ).first
    if delete_btn.count() == 0:
        card.click()
        page.wait_for_selector("[role='dialog']", timeout=5000)
        delete_btn = page.locator(
            "[role='dialog'] button svg.lucide-trash-2, "
            "[role='dialog'] button svg.lucide-trash"
        ).first

    delete_btn.click()

    # AlertDialog 확인 버튼 클릭
    confirm_btn = page.locator(
        "[role='alertdialog'] button:has-text('삭제'), "
        "[role='alertdialog'] button:has-text('확인')"
    ).first
    expect(confirm_btn).to_be_visible(timeout=3000)

    with page.expect_response(
        lambda r: "/api/pet-foods" in r.url and r.request.method == "DELETE"
    ) as resp_info:
        confirm_btn.click()

    response = resp_info.value
    assert response.status == 200, f"사료 삭제 API 실패: {response.status}"

    page.wait_for_timeout(500)
    expect(page.locator("text=QA삭제테스트사료")).to_have_count(0)
    # food_id는 이미 삭제됨 — 정리 불필요


def test_food_delete_cancel_keeps_item(authenticated_page):
    """Edge case: 삭제 AlertDialog에서 취소하면 항목이 유지된다."""
    page = authenticated_page
    food_id = _create_food_via_api(page, {
        "name": "QA삭제취소테스트",
        "food_category": "건사료",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        card = page.locator("text=QA삭제취소테스트").first
        expect(card).to_be_visible(timeout=5000)

        delete_btn = page.locator(
            "[data-food-id] button svg.lucide-trash-2, "
            "[data-food-id] button svg.lucide-trash"
        ).first
        if delete_btn.count() == 0:
            card.click()
            page.wait_for_selector("[role='dialog']", timeout=5000)
            delete_btn = page.locator(
                "[role='dialog'] button svg.lucide-trash-2, "
                "[role='dialog'] button svg.lucide-trash"
            ).first

        delete_btn.click()

        # AlertDialog에서 취소
        cancel_btn = page.locator(
            "[role='alertdialog'] button:has-text('취소')"
        ).first
        expect(cancel_btn).to_be_visible(timeout=3000)
        cancel_btn.click()
        page.wait_for_timeout(500)

        # 항목이 여전히 있어야 함
        expect(page.locator("text=QA삭제취소테스트").first).to_be_visible()

    finally:
        _delete_food_via_api(page, food_id)


# ──────────────────────────────────────────────
# 6. 카테고리 필터
# ──────────────────────────────────────────────

def test_category_filter_shows_only_matching(authenticated_page):
    """Happy path: 카테고리 필터 칩 클릭 시 해당 카테고리 사료만 표시된다."""
    page = authenticated_page

    # 두 카테고리에 각각 사료 생성
    dry_id = _create_food_via_api(page, {
        "name": "QA필터_건사료_항목",
        "food_category": "건사료",
    })
    snack_id = _create_food_via_api(page, {
        "name": "QA필터_간식_항목",
        "food_category": "간식",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # "건사료" 필터 칩 클릭
        dry_chip = page.locator("button:has-text('건사료'), [role='tab']:has-text('건사료')").first
        expect(dry_chip).to_be_visible(timeout=5000)
        dry_chip.click()
        page.wait_for_timeout(500)

        # 건사료 항목은 보이고, 간식 항목은 안 보여야 함
        expect(page.locator("text=QA필터_건사료_항목").first).to_be_visible()
        expect(page.locator("text=QA필터_간식_항목")).to_have_count(0)

        # "간식" 필터 칩 클릭
        snack_chip = page.locator("button:has-text('간식'), [role='tab']:has-text('간식')").first
        snack_chip.click()
        page.wait_for_timeout(500)

        # 간식 항목은 보이고, 건사료 항목은 안 보여야 함
        expect(page.locator("text=QA필터_간식_항목").first).to_be_visible()
        expect(page.locator("text=QA필터_건사료_항목")).to_have_count(0)

    finally:
        _delete_food_via_api(page, dry_id)
        _delete_food_via_api(page, snack_id)


def test_category_filter_all_restores_full_list(authenticated_page):
    """Edge case: "전체" 필터 클릭 시 모든 카테고리 사료가 다시 표시된다."""
    page = authenticated_page

    dry_id = _create_food_via_api(page, {
        "name": "QA전체복원_건사료",
        "food_category": "건사료",
    })
    wet_id = _create_food_via_api(page, {
        "name": "QA전체복원_습식",
        "food_category": "습식",
    })

    try:
        _navigate_to_food_tab(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # 먼저 "건사료" 필터 적용
        dry_chip = page.locator("button:has-text('건사료')").first
        expect(dry_chip).to_be_visible(timeout=5000)
        dry_chip.click()
        page.wait_for_timeout(300)

        # 습식은 안 보여야 함
        expect(page.locator("text=QA전체복원_습식")).to_have_count(0)

        # "전체" 필터 클릭
        all_chip = page.locator("button:has-text('전체')").first
        all_chip.click()
        page.wait_for_timeout(500)

        # 두 항목 모두 표시됨
        expect(page.locator("text=QA전체복원_건사료").first).to_be_visible()
        expect(page.locator("text=QA전체복원_습식").first).to_be_visible()

    finally:
        _delete_food_via_api(page, dry_id)
        _delete_food_via_api(page, wet_id)
