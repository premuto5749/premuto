#!/usr/bin/env node

/**
 * 마스터 데이터 버전 동기화 스크립트
 *
 * Source of Truth: config/master_data_v3.json
 *
 * 마스터 데이터의 버전, 항목 수, 별칭 수를
 * 모든 관련 문서에 자동으로 동기화합니다.
 *
 * 사용법: node scripts/sync-version-numbers.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ============================================
// Source of Truth 읽기
// ============================================
const masterData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/master_data_v3.json'), 'utf-8')
);

const { version } = masterData;
const { test_items, aliases, total_recognizable_names } = masterData.stats;

console.log('마스터 데이터 버전 동기화');
console.log(`  버전: ${version}`);
console.log(`  표준항목: ${test_items}개`);
console.log(`  별칭: ${aliases}개`);
console.log(`  총 인식 가능: ${total_recognizable_names}개`);
console.log('');

// ============================================
// 동기화 대상 파일 정의
// ============================================
const updates = [
  {
    file: 'docs/standard_items_master.json',
    type: 'json-stats',
  },
  {
    file: 'CLAUDE.md',
    type: 'regex',
    replacements: [
      // "마스터 데이터 v4.3 (129개 표준항목, 107개 별칭"
      [
        /마스터 데이터 v[\d.]+\s*\(\d+개 표준항목,\s*\d+개 별칭/g,
        `마스터 데이터 ${version} (${test_items}개 표준항목, ${aliases}개 별칭`,
      ],
      // "정규항목 129개 + alias 107개"
      [
        /정규항목 \d+개 \+ alias \d+개/g,
        `정규항목 ${test_items}개 + alias ${aliases}개`,
      ],
      // "마스터 v4.3 (129개 정규항목, 107개 alias = 236개 이름 인식)"
      [
        /마스터 v[\d.]+\s*\(\d+개 정규항목,\s*\d+개 alias\s*=\s*\d+개 이름 인식\)/g,
        `마스터 ${version} (${test_items}개 정규항목, ${aliases}개 alias = ${total_recognizable_names}개 이름 인식)`,
      ],
    ],
  },
  {
    file: 'docs/admin-features.md',
    type: 'regex',
    replacements: [
      [/\d+개 표준 검사항목 관리/g, `${test_items}개 표준 검사항목 관리`],
      [/\d+개 별칭 관리/g, `${aliases}개 별칭 관리`],
    ],
  },
  {
    file: 'docs/mapping_logic.md',
    type: 'regex',
    replacements: [
      // "v4.3 (정규항목 129개, alias 107개 = 236개 이름 인식)"
      [
        /v[\d.]+\s*\(정규항목 \d+개,\s*alias \d+개\s*=\s*\d+개 이름 인식\)/g,
        `${version} (정규항목 ${test_items}개, alias ${aliases}개 = ${total_recognizable_names}개 이름 인식)`,
      ],
    ],
  },
  {
    file: 'app/api/admin/sync-master-data/route.ts',
    type: 'regex',
    replacements: [
      [/\d+개 test_items/g, `${test_items}개 test_items`],
      [/\d+개 aliases/g, `${aliases}개 aliases`],
      [
        /standard_items 동기화 \(\d+개 항목/g,
        `standard_items 동기화 (${test_items}개 항목`,
      ],
      [
        /item_aliases 동기화 \(\d+개 별칭\)/g,
        `item_aliases 동기화 (${aliases}개 별칭)`,
      ],
    ],
  },
  {
    file: 'migrations/001_replace_master_data.sql',
    type: 'regex',
    replacements: [
      [/-- 버전: v[\d.]+/g, `-- 버전: ${version}`],
      [
        /-- 항목 수: \d+개 표준항목, \d+개 별칭/g,
        `-- 항목 수: ${test_items}개 표준항목, ${aliases}개 별칭`,
      ],
      [
        /standard_items_master INSERT \(\d+개\)/g,
        `standard_items_master INSERT (${test_items}개)`,
      ],
      [
        /item_aliases_master INSERT \(\d+개\)/g,
        `item_aliases_master INSERT (${aliases}개)`,
      ],
    ],
  },
];

// ============================================
// 동기화 실행
// ============================================
let totalChanges = 0;

for (const update of updates) {
  const filePath = path.join(ROOT, update.file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${update.file} — 파일 없음, 건너뜀`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf-8');
  let updated;

  if (update.type === 'json-stats') {
    // JSON 파일은 stats 블록만 regex로 업데이트 (원본 포맷 보존)
    updated = original
      .replace(/"version":\s*"v[\d.]+"/, `"version": "${version}"`)
      .replace(/"test_items":\s*\d+/, `"test_items": ${test_items}`)
      .replace(/"aliases":\s*\d+/, `"aliases": ${aliases}`)
      .replace(/"total_recognizable_names":\s*\d+/, `"total_recognizable_names": ${total_recognizable_names}`);
  } else {
    updated = original;
    for (const [pattern, replacement] of update.replacements) {
      updated = updated.replace(pattern, replacement);
    }
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
    console.log(`✅ ${update.file} — 업데이트됨`);
    totalChanges++;
  } else {
    console.log(`⏭️  ${update.file} — 변경 없음 (이미 최신)`);
  }
}

console.log('');
console.log(`완료: ${totalChanges}개 파일 업데이트됨`);

if (totalChanges > 0) {
  console.log('');
  console.log('💡 변경된 파일을 커밋하세요:');
  console.log('   git add -A && git commit -m "docs: 마스터 데이터 버전 동기화"');
}
