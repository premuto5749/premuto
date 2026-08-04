# Project Changelog

All notable changes to Premuto are documented in this file.

---

## [2026-03-06] - Food Ingredients Feature (v3.3)

### Added
- Pet food & snack ingredients management system (/manage → "성분" tab)
- Photo OCR analysis for automatic nutrient extraction (Claude API)
- CRUD API for pet foods with RLS isolation (GET/POST/PATCH/DELETE)
- Dynamic ingredient form with add/remove nutrient rows
- 8 predefined nutrient units (g, mg, mcg, %, kcal, IU, ppm, ml)
- Category filtering for food types (dry, wet, supplement)
- Tier-based OCR quota system (Free: 0, Basic: 10/month, Premium: unlimited)
- Database tables: nutrient_units, pet_food_nutrients (bridge table)
- API endpoints: /api/pet-foods, /api/pet-foods/upload, /api/pet-foods/ocr, /api/nutrient-units
- TypeScript types: PetFood, PetFoodNutrient, NutrientUnit, PetFoodOcrResult

### Changed
- /manage page: Added "성분" (ingredients) tab alongside existing features
- pet_foods table: Extended with food_category, origin, calories_per_kg, photo_urls columns
- API response format standardization for OCR results

### Fixed
- API column name unification (calories_per_kg, value, sort_order) — commit #12
- Supabase nested join mapping for pet_food_nutrients display — commit #12
- OCR request format standardization ({files} array) — commit #13
- photo_urls persistence in POST/PATCH operations — commit #13
- food_category backward compatibility in calorie calculator — commit #10
- ESLint image component warnings — commit #11

### Quality Metrics
- Design Match Rate: 91% (exceeds 90% threshold)
- E2E Test Coverage: 10/10 scenarios passed
- Database: 2 new tables, RLS policies enforced
- Code Statistics: 13 commits, 10 files, +1,717 lines added

### Related
- PR #296: https://github.com/premuto5749/premuto/pull/296
- Completion Report: docs/04-report/features/food-ingredients.report.md

---

## [Previous Versions]

*(Changelog entries for prior versions would be documented here)*

---

## Contributing

When adding new features, update this changelog following the format above.

### Format Guidelines
- **[Date] - Feature Name (vX.X)**: YYYY-MM-DD format
- **Added**: New functionality and features
- **Changed**: Modifications to existing functionality
- **Fixed**: Bug fixes and corrections
- **Deprecated**: Features scheduled for removal
- **Removed**: Features no longer present
- **Security**: Security-related fixes

### PR Linking
Always include PR number and link: `PR #NNN: https://github.com/premuto5749/premuto/pull/NNN`

### Completion Report
Reference the feature completion report: `docs/04-report/features/{feature}.report.md`
