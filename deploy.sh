#!/bin/bash

echo "🚀 Mimo Health Log를 Vercel에 배포합니다..."
echo ""
echo "Step 1: Vercel 로그인"
echo "브라우저가 열리면 GitHub 계정으로 로그인하세요."
echo ""

vercel login

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 로그인 성공!"
    echo ""
    echo "Step 2: 프로덕션 배포 시작..."
    echo ""

    vercel --prod --yes

    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 배포 완료!"
        echo "위에 표시된 URL을 모바일에서 열어보세요!"
    else
        echo ""
        echo "❌ 배포 실패. 위 에러 메시지를 확인해주세요."
    fi
else
    echo ""
    echo "❌ 로그인 실패. 다시 시도해주세요."
fi
