export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">서비스 이용약관</h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-3">제1조 (목적)</h2>
            <p>
              이 약관은 프리무토(이하 &quot;회사&quot;)가 제공하는 반려동물 건강 기록 서비스
              &quot;Premuto&quot;(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의
              권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제2조 (정의)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>&quot;서비스&quot;란 회사가 제공하는 반려동물 건강 기록 관리 웹 애플리케이션을 의미합니다.</li>
              <li>&quot;이용자&quot;란 이 약관에 따라 회사와 이용계약을 체결하고 서비스를 이용하는 자를 말합니다.</li>
              <li>&quot;계정&quot;이란 이용자가 서비스에 로그인하기 위해 설정한 이메일과 비밀번호의 조합을 말합니다.</li>
              <li>&quot;콘텐츠&quot;란 이용자가 서비스 내에 기록·업로드한 반려동물 건강 데이터, 혈액검사 결과, 이미지 등 일체의 정보를 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 변경된 약관은 적용일 7일 전에 공지합니다.</li>
              <li>이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제4조 (서비스의 내용)</h2>
            <p>회사가 제공하는 서비스의 내용은 다음과 같습니다.</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>반려동물 일일 건강 기록 (식사, 음수, 투약, 배변, 배뇨, 호흡수 등)</li>
              <li>혈액검사 결과 OCR 판독 및 데이터베이스 저장</li>
              <li>검사 결과 시계열 트렌드 분석 및 시각화</li>
              <li>건강 기록 내보내기 (Excel 등)</li>
              <li>기타 회사가 추가 개발하여 제공하는 서비스</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제5조 (이용계약의 성립)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용계약은 이용자가 약관에 동의하고 회원가입 신청을 한 후 회사가 이를 승낙함으로써 성립됩니다.</li>
              <li>회사는 다음 각 호에 해당하는 경우 가입을 거절하거나 사후에 이용계약을 해지할 수 있습니다.
                <ul className="list-disc pl-5 mt-1">
                  <li>타인의 정보를 도용한 경우</li>
                  <li>허위 정보를 기재한 경우</li>
                  <li>기타 이용 신청 요건이 미비된 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제6조 (이용자의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용자는 계정 정보를 안전하게 관리해야 하며, 이를 제3자에게 공유해서는 안 됩니다.</li>
              <li>이용자는 서비스를 이용하여 법령 또는 이 약관에 위배되는 행위를 해서는 안 됩니다.</li>
              <li>이용자는 다음 행위를 하여서는 안 됩니다.
                <ul className="list-disc pl-5 mt-1">
                  <li>서비스의 안정적 운영을 방해하는 행위</li>
                  <li>다른 이용자의 개인정보를 수집·저장·유포하는 행위</li>
                  <li>서비스를 이용하여 상업적 목적의 활동을 하는 행위 (회사의 사전 동의 없이)</li>
                  <li>서비스의 취약점을 악용하거나 비정상적인 방법으로 접근하는 행위</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제7조 (서비스의 제공 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 이용자에게 서비스를 연중무휴, 1일 24시간 제공하는 것을 원칙으로 합니다.</li>
              <li>회사는 서비스 개선을 위해 서비스의 내용을 변경할 수 있으며, 중요한 변경 시 사전에 공지합니다.</li>
              <li>회사는 다음 각 호에 해당하는 경우 서비스의 전부 또는 일부를 제한하거나 중단할 수 있습니다.
                <ul className="list-disc pl-5 mt-1">
                  <li>서비스 설비의 보수 등 공사로 인한 부득이한 경우</li>
                  <li>천재지변, 국가비상사태 등 불가항력적 사유가 있는 경우</li>
                  <li>기타 중대한 사유로 서비스 제공이 곤란한 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제8조 (서비스 이용 요금)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>서비스는 무료(Free) 및 유료(Basic, Premium) 티어로 구분되어 제공됩니다.</li>
              <li>유료 서비스의 이용 요금 및 결제 방법은 서비스 내 별도 안내에 따릅니다.</li>
              <li>회사는 유료 서비스의 요금을 변경할 수 있으며, 변경 시 30일 전에 공지합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제9조 (계약 해지 및 탈퇴)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용자는 언제든지 서비스 내 설정 메뉴를 통해 탈퇴를 요청할 수 있습니다.</li>
              <li>회사는 탈퇴 요청 시 관련 법령 및 개인정보 처리방침에 따라 이용자의 정보를 처리합니다.</li>
              <li>회사는 이용자가 제6조의 의무를 위반한 경우 사전 통보 후 이용계약을 해지할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제10조 (면책 조항)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>본 서비스는 반려동물 건강 데이터를 기록·보관하는 도구이며, 어떠한 의료적 의견이나 진단을 제공하지 않습니다.</li>
              <li>OCR 판독 및 AI 매핑 결과의 정확성에 대해 회사는 보증하지 않으며, 최종 확인은 이용자의 책임입니다.</li>
              <li>이용자가 기록한 데이터의 정확성 및 이를 기반으로 한 의학적 판단에 대해 회사는 책임을 지지 않습니다.</li>
              <li>천재지변, 서비스 장애 등 불가항력으로 인한 서비스 중단에 대해 회사는 책임을 지지 않습니다.</li>
              <li>의학적 치료 관련 판단은 반드시 수의사와 상의하시기 바랍니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제11조 (지식재산권)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>서비스에 대한 저작권 및 지식재산권은 회사에 귀속됩니다.</li>
              <li>이용자가 서비스에 기록한 콘텐츠에 대한 권리는 이용자에게 귀속됩니다.</li>
              <li>회사는 서비스 개선 및 통계 목적으로 이용자의 콘텐츠를 비식별화하여 활용할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">제12조 (분쟁 해결)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</li>
              <li>서비스 이용과 관련하여 분쟁이 발생한 경우 회사의 본사 소재지를 관할하는 법원을 관할 법원으로 합니다.</li>
            </ol>
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
