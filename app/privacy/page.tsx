export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">개인정보 처리방침</h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">
          <p>
            프리무토(이하 &quot;회사&quot;)는 「개인정보 보호법」에 따라 이용자의 개인정보를
            보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이
            개인정보 처리방침을 수립·공개합니다.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-3">제1조 (수집하는 개인정보 항목)</h2>
            <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
            <table className="w-full text-sm border-collapse mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">구분</th>
                  <th className="text-left py-2 font-medium">수집 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 align-top">필수 수집</td>
                  <td className="py-2">이메일 주소, 비밀번호(암호화 저장)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 align-top">카카오 로그인 시</td>
                  <td className="py-2">카카오 계정 이메일, 카카오 고유 식별자</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 align-top">서비스 이용 시</td>
                  <td className="py-2">반려동물 정보(이름, 종, 생년월일, 몸무게), 일일 건강 기록(식사, 음수, 투약, 배변, 배뇨, 호흡수), 혈액검사 데이터, 업로드된 검사지 이미지/PDF</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 align-top">자동 수집</td>
                  <td className="py-2">서비스 이용 기록, 접속 로그, 쿠키</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제2조 (개인정보의 수집 및 이용 목적)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회원가입 및 본인 확인</li>
              <li>반려동물 건강 기록 서비스 제공</li>
              <li>혈액검사 결과 OCR 판독 및 데이터 분석</li>
              <li>서비스 개선 및 신규 기능 개발</li>
              <li>이용자 문의 대응 및 공지사항 전달</li>
              <li>서비스 이용 통계 및 분석 (비식별화 처리)</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제3조 (개인정보의 처리 위탁)</h2>
            <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
            <table className="w-full text-sm border-collapse mt-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">수탁 업체</th>
                  <th className="text-left py-2 pr-4 font-medium">위탁 업무</th>
                  <th className="text-left py-2 font-medium">처리 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">Supabase Inc.</td>
                  <td className="py-2 pr-4">데이터베이스 호스팅, 사용자 인증</td>
                  <td className="py-2">계정 정보, 건강 기록 데이터</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Anthropic PBC</td>
                  <td className="py-2 pr-4">검사지 OCR 판독 (Claude API)</td>
                  <td className="py-2">업로드된 검사지 이미지/PDF</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">OpenAI Inc.</td>
                  <td className="py-2 pr-4">검사항목 AI 매핑</td>
                  <td className="py-2">검사항목명, 수치 데이터</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Vercel Inc.</td>
                  <td className="py-2 pr-4">웹 애플리케이션 호스팅</td>
                  <td className="py-2">접속 로그</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-sm text-muted-foreground">
              위탁 업체의 서버는 해외(미국 등)에 위치할 수 있으며, 회사는 위탁 계약 시 개인정보보호 관련 사항을 규정하고 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제4조 (개인정보의 보유 및 이용 기간)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회원 탈퇴 시까지 보유하며, 탈퇴 요청 시 지체 없이 파기합니다.</li>
              <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
                <ul className="list-disc pl-5 mt-1">
                  <li>전자상거래법에 따른 계약·청약철회 기록: 5년</li>
                  <li>전자상거래법에 따른 대금결제 및 재화 공급 기록: 5년</li>
                  <li>통신비밀보호법에 따른 접속 로그 기록: 3개월</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제5조 (개인정보의 파기 절차 및 방법)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>파기 절차: 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다.</li>
              <li>파기 방법:
                <ul className="list-disc pl-5 mt-1">
                  <li>전자적 파일: 복구 불가능한 방법으로 영구 삭제</li>
                  <li>기록물: 파쇄 또는 소각</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제6조 (이용자의 권리와 행사 방법)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용자는 언제든지 자신의 개인정보에 대해 열람, 수정, 삭제, 처리정지를 요청할 수 있습니다.</li>
              <li>권리 행사는 서비스 내 설정 메뉴를 통하거나, 이메일(minsook1@withpremuto.com)로 요청할 수 있습니다.</li>
              <li>이용자가 개인정보의 삭제를 요청한 경우, 회사는 지체 없이 해당 개인정보를 파기합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제7조 (개인정보의 안전성 확보 조치)</h2>
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>데이터베이스 행 수준 보안(RLS) 적용으로 사용자 간 데이터 격리</li>
              <li>SSL/TLS 암호화 통신</li>
              <li>접근 권한 최소화 및 관리</li>
              <li>파일 저장소 사용자별 폴더 격리</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제8조 (쿠키의 사용)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 이용자 인증 및 세션 유지를 위해 쿠키를 사용합니다.</li>
              <li>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제9조 (개인정보 보호책임자)</h2>
            <ul className="space-y-1">
              <li>성명: 김민수</li>
              <li>직위: 대표</li>
              <li>이메일: minsook1@withpremuto.com</li>
            </ul>
            <p className="mt-2">
              이용자는 서비스 이용 중 발생한 개인정보 보호 관련 문의, 불만 처리, 피해 구제 등에
              관한 사항을 개인정보 보호책임자에게 문의할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제10조 (권익 침해 구제 방법)</h2>
            <p>개인정보 침해에 대한 신고·상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.</p>
            <ul className="space-y-1 mt-2">
              <li>개인정보침해 신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
              <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제11조 (방침 변경)</h2>
            <p>
              이 개인정보 처리방침은 시행일로부터 적용되며, 관련 법령 및 방침에 따라 변경이 있는
              경우 변경 사항은 시행 7일 전부터 서비스를 통해 공지합니다.
            </p>
          </section>

          <section className="border-t pt-6 mt-8">
            <h2 className="text-lg font-semibold mb-3">사업자 정보</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>상호: 프리무토</li>
              <li>대표자: 김민수</li>
              <li>사업자등록번호: 480-57-00855</li>
              <li>소재지: 경기도 수원시 장안구 송죽로 9-1, 2층</li>
              <li>이메일: minsook1@withpremuto.com</li>
            </ul>
          </section>

          <p className="text-sm text-muted-foreground pt-4">
            시행일: 2025년 1월 1일
          </p>
        </div>
      </div>
    </div>
  )
}
