/**
 * V FOR X — Dossier content translations (10 languages)
 *
 * Full i18n for all 13 dossiers: subjects, accusations, evidence,
 * right of response, and country data references.
 *
 * Supported languages: en, pt, es, fr, zh, ja, ko, hi, ar, ru
 */

import type { Lang } from "./i18n";

export interface DossierI18n {
  subject: string;
  accusation: string;
  evidence: string[];
  rightOfResponse: string;
  countryDataRef: string;
}

export const DOSSIER_I18N: Record<string, Partial<Record<Lang, DossierI18n>>> = {

  /* ═══════════════════════════════════════════════════════════════
     REG-001 — [REDACTED] Former Minister of Defense, Sudan
     ═══════════════════════════════════════════════════════════════ */
  "REG-001": {
    en: {
      subject: "[REDACTED] — Former Minister of Defense, [COUNTRY]",
      accusation: "Ordered systematic blockade of humanitarian aid to contested regions during active famine conditions. Evidence of weaponizing hunger as a tool of war against civilian population.",
      evidence: [
        "UN Panel of Experts report documenting aid convoy blockades (2024)",
        "Satellite imagery showing destroyed food storage facilities",
        "Amnesty International investigation — witness testimonies from 47 aid workers",
      ],
      rightOfResponse: "No response offered",
      countryDataRef: "Conflict intensity: 5/5 · Displacement: 8.1M · Famine risk: 5/5",
    },
    pt: {
      subject: "[REDACTED] — Ex-Ministro da Defesa, [PAÍS]",
      accusation: "Ordenou bloqueio sistemático de ajuda humanitária a regiões disputadas durante condições de fome ativa. Evidência de uso da fome como arma de guerra contra a população civil.",
      evidence: [
        "Relatório do Painel de Especialistas da ONU documentando bloqueios de comboios de ajuda (2024)",
        "Imagens de satélite mostrando instalações de armazenamento de alimentos destruídas",
        "Investigação da Anistia Internacional — testemunhos de 47 trabalhadores humanitários",
      ],
      rightOfResponse: "Nenhuma resposta oferecida",
      countryDataRef: "Intensidade do conflito: 5/5 · Deslocamento: 8.1M · Risco de fome: 5/5",
    },
    es: {
      subject: "[REDACTED] — Exministro de Defensa, [PAÍS]",
      accusation: "Ordenó el bloqueo sistemático de ayuda humanitaria a regiones en disputa durante condiciones de hambruna activa. Evidencia del uso del hambre como arma de guerra contra la población civil.",
      evidence: [
        "Informe del Panel de Expertos de la ONU documentando el bloqueo de convoyes de ayuda (2024)",
        "Imágenes satelitales que muestran instalaciones de almacenamiento de alimentos destruidas",
        "Investigación de Amnistía Internacional — testimonios de 47 trabajadores humanitarios",
      ],
      rightOfResponse: "Ninguna respuesta ofrecida",
      countryDataRef: "Intensidad del conflicto: 5/5 · Desplazamiento: 8.1M · Riesgo de hambruna: 5/5",
    },
    fr: {
      subject: "[REDACTED] — Ancien ministre de la Défense, [PAYS]",
      accusation: "A ordonné le blocus systématique de l'aide humanitaire vers les régions contestées pendant des conditions de famine active. Preuve de l'armement de la faim comme outil de guerre contre la population civile.",
      evidence: [
        "Rapport du Groupe d'experts de l'ONU documentant le blocage des convois d'aide (2024)",
        "Imagerie satellite montrant des installations de stockage alimentaire détruites",
        "Enquête d'Amnesty International — témoignages de 47 travailleurs humanitaires",
      ],
      rightOfResponse: "Aucune réponse offerte",
      countryDataRef: "Intensité du conflit: 5/5 · Déplacement: 8.1M · Risque de famine: 5/5",
    },
    zh: {
      subject: "[REDACTED] — 前国防部长，[国家]",
      accusation: "在活跃饥荒条件下下令对争议地区实施系统性人道主义援助封锁。有证据表明将饥饿武器化，作为针对平民人口的战争工具。",
      evidence: [
        "联合国专家组报告，记录援助车队封锁（2024年）",
        "卫星图像显示被摧毁的粮食储存设施",
        "国际特赦组织调查——47名人道主义工作者的证词",
      ],
      rightOfResponse: "未提出任何回应",
      countryDataRef: "冲突强度: 5/5 · 流离失所: 8.1M · 饥荒风险: 5/5",
    },
    ja: {
      subject: "[REDACTED] — 元国防大臣、[国]",
      accusation: "飢饉が発生している紛争地域への人道支援の組織的封鎖を命じた。民間人に対する戦争の道具としての飢餓の武器化の証拠。",
      evidence: [
        "国連専門家パネルによる援助車列封鎖を記録した報告書（2024年）",
        "破壊された食糧貯蔵施設を示す衛星画像",
        "アムネスティ・インターナショナルの調査——47人の援助労働者の証言",
      ],
      rightOfResponse: "回答の申し出なし",
      countryDataRef: "紛争の激しさ: 5/5 · 避難者数: 8.1M · 飢饉リスク: 5/5",
    },
    ko: {
      subject: "[REDACTED] — 전 국방장관, [국가]",
      accusation: "활발한 기근 상황에서 분쟁 지역에 대한 인도적 지원의 조직적 봉쇄를 명령함. 민간인 인구에 대한 전쟁 도구로서 기아를 무기화한 증거.",
      evidence: [
        "지원 호송대 봉쇄를 기록한 유엔 전문가 패널 보고서(2024년)",
        "파괴된 식량 저장 시설을 보여주는 위성 이미지",
        "국제사면위원회 조사 — 47명의 구호 요원의 증언",
      ],
      rightOfResponse: "제출된 답변 없음",
      countryDataRef: "갈등 강도: 5/5 · 실향민: 8.1M · 기근 위험: 5/5",
    },
    hi: {
      subject: "[REDACTED] — पूर्व रक्षा मंत्री, [देश]",
      accusation: "सक्रिय अकाल की स्थिति के दौरान विवादित क्षेत्रों में मानवीय सहायता के व्यवस्थित नाकेबंदी का आदेश दिया। नागरिक आबादी के खिलाफ युद्ध के हथियार के रूप में भूख के हथियारीकरण का सबूत।",
      evidence: [
        "सहायता काफिला नाकेबंदी का दस्तावेजीकरण करती संयुक्त राष्ट्र विशेषज्ञ पैनल रिपोर्ट (2024)",
        "नष्ट किए गए खाद्य भंडारण सुविधाओं को दिखाने वाली उपग्रह छवियां",
        "एमनेस्टी इंटरनेशनल की जांच — 47 राहत कर्मियों के गवाह बयान",
      ],
      rightOfResponse: "कोई प्रतिक्रिया नहीं दी गई",
      countryDataRef: "संघर्ष की तीव्रता: 5/5 · विस्थापन: 8.1M · अकाल जोखिम: 5/5",
    },
    ar: {
      subject: "[REDACTED] — وزير الدفاع السابق، [بلد]",
      accusation: "أمر بحصار منهجي للمساعدات الإنسانية عن المناطق المتنازع عليها خلال ظروف المجاعة النشطة. دليل على استخدام الجوع كسلاح حربي ضد السكان المدنيين.",
      evidence: [
        "تقرير فريق الخبراء التابع للأمم المتحدة الذي يوثق حصار قوافل المساعدات (2024)",
        "صور أقمار صناعية تظهر منشآت تخزين الأغذية المدمرة",
        "تحقيق منظمة العفو الدولية — شهادات من 47 عاملاً إنسانياً",
      ],
      rightOfResponse: "لم يتم تقديم أي رد",
      countryDataRef: "شدة الصراع: 5/5 · النزوح: 8.1M · خطر المجاعة: 5/5",
    },
    ru: {
      subject: "[REDACTED] — Бывший министр обороны, [СТРАНА]",
      accusation: "Отдал приказ о систематической блокаде гуманитарной помощи в спорные регионы во время активного голода. Доказательства использования голода в качестве оружия войны против гражданского населения.",
      evidence: [
        "Доклад Группы экспертов ООН, задокументировавший блокаду конвоев с гуманитарной помощью (2024)",
        "Спутниковые снимки, показывающие разрушенные объекты хранения продовольствия",
        "Расследование Amnesty International — показания 47 гуманитарных работников",
      ],
      rightOfResponse: "Ответ не предоставлен",
      countryDataRef: "Интенсивность конфликта: 5/5 · Перемещение: 8.1M · Риск голода: 5/5",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     REG-002 — [REDACTED] CEO, Multinational Agri Corp, Brazil
     ═══════════════════════════════════════════════════════════════ */
  "REG-002": {
    en: {
      subject: "[REDACTED] — CEO, [MULTINATIONAL AGRI CORP]",
      accusation: "Systematic land grabbing from indigenous communities. Use of paramilitary groups to forcibly displace traditional populations for monoculture expansion.",
      evidence: [
        "Land registry fraud documentation by federal prosecutors",
        "Investigative journalism series by major outlet",
        "Testimony of 12 displaced families",
      ],
      rightOfResponse: "Company denies all allegations. Claims all land acquisitions were legal.",
      countryDataRef: "CPI Score: 36/100 · Political Corruption Index: 0.55",
    },
    pt: {
      subject: "[REDACTED] — CEO, [MULTINACIONAL AGRO]",
      accusation: "Grilagem sistemática de terras de comunidades indígenas. Uso de grupos paramilitares para deslocar à força populações tradicionais para expansão do monocultivo.",
      evidence: [
        "Documentação de fraude no registro de terras por procuradores federais",
        "Série de jornalismo investigativo de grande veículo",
        "Testemunho de 12 famílias deslocadas",
      ],
      rightOfResponse: "A empresa nega todas as alegações. Afirma que todas as aquisições de terras foram legais.",
      countryDataRef: "Pontuação IPC: 36/100 · Índice de Corrupção Política: 0.55",
    },
    es: {
      subject: "[REDACTED] — CEO, [MULTINACIONAL AGRO]",
      accusation: "Apropiación sistemática de tierras de comunidades indígenas. Uso de grupos paramilitares para desplazar por la fuerza a poblaciones tradicionales para la expansión del monocultivo.",
      evidence: [
        "Documentación de fraude en el registro de tierras por fiscales federales",
        "Serie de periodismo de investigación de un medio importante",
        "Testimonio de 12 familias desplazadas",
      ],
      rightOfResponse: "La empresa niega todas las acusaciones. Afirma que todas las adquisiciones de tierras fueron legales.",
      countryDataRef: "Puntuación IPC: 36/100 · Índice de Corrupción Política: 0.55",
    },
    fr: {
      subject: "[REDACTED] — PDG, [MULTINATIONALE AGRO]",
      accusation: "Accaparement systématique des terres des communautés autochtones. Utilisation de groupes paramilitaires pour déplacer de force les populations traditionnelles afin d'étendre la monoculture.",
      evidence: [
        "Documentation de fraude au cadastre foncier par des procureurs fédéraux",
        "Série de journalisme d'investigation d'un grand média",
        "Témoignage de 12 familles déplacées",
      ],
      rightOfResponse: "L'entreprise nie toutes les allégations. Affirme que toutes les acquisitions de terres étaient légales.",
      countryDataRef: "Score IPC: 36/100 · Indice de Corruption Politique: 0.55",
    },
    zh: {
      subject: "[REDACTED] — 首席执行官，[跨国农业公司]",
      accusation: "系统性掠夺原住民社区土地。利用准军事组织强行驱逐传统居民以扩张单一作物种植。",
      evidence: [
        "联邦检察官对土地登记欺诈的文件记录",
        "大型媒体的调查性新闻报道系列",
        "12个被驱逐家庭的证词",
      ],
      rightOfResponse: "公司否认所有指控。声称所有土地收购都是合法的。",
      countryDataRef: "清廉指数得分: 36/100 · 政治腐败指数: 0.55",
    },
    ja: {
      subject: "[REDACTED] — CEO、[多国籍農業コンツェルン]",
      accusation: "先住民コミュニティからの土地の組織的収奪。モノカルチャー拡大のために準軍事組織を用いて伝統的住民を強制移住させる。",
      evidence: [
        "連邦検察官による土地登記詐欺の文書",
        "大手メディアによる調査報道シリーズ",
        "強制移住させられた12家族の証言",
      ],
      rightOfResponse: "企業はすべての告発を否定。すべての土地取得は合法的であると主張。",
      countryDataRef: "CPIスコア: 36/100 · 政治腐敗指数: 0.55",
    },
    ko: {
      subject: "[REDACTED] — CEO, [다국적 농업 기업]",
      accusation: "원주민 공동체의 토지를 조직적으로 탈취함. 단일 재배 확장을 위해 준군사 조직을 동원하여 전통적 인구를 강제 이주시킴.",
      evidence: [
        "연방 검사관의 토지 등기 사기 문서",
        "주요 매체의 조사 보도 시리즈",
        "강제 이주된 12가족의 증언",
      ],
      rightOfResponse: "기업은 모든 혐의를 부인함. 모든 토지 취득이 합법적이었다고 주장.",
      countryDataRef: "CPI 점수: 36/100 · 정치 부패 지수: 0.55",
    },
    hi: {
      subject: "[REDACTED] — सीईओ, [बहुराष्ट्रीय कृषि निगम]",
      accusation: "आदिवासी समुदायों की भूमि का व्यवस्थित कब्जा। एकाकृपि विस्तार के लिए पैरामिलिट्री समूहों का उपयोग करके पारंपरिक आबादी को जबरन विस्थापित करना।",
      evidence: [
        "संघीय अभियोजकों द्वारा भूमि रजिस्ट्री धोखाधड़ी का दस्तावेजीकरण",
        "प्रमुख मीडिया आउटलेट की जांचात्मक पत्रकारिता श्रृंखला",
        "12 विस्थापित परिवारों का गवाह बयान",
      ],
      rightOfResponse: "कंपनी सभी आरोपों से इनकार करती है। सभी भूमि अधिग्रहण कानूनी थे ऐसा दावा करती है।",
      countryDataRef: "CPI स्कोर: 36/100 · राजनीतिक भ्रष्टाचार सूचकांक: 0.55",
    },
    ar: {
      subject: "[REDACTED] — الرئيس التنفيذي، [شركة زراعية متعددة الجنسيات]",
      accusation: "الاستيلاء المنهجي على أراضي المجتمعات الأصلية. استخدام جماعات شبه عسكرية لإخلاء السكان التقليديين بالقوة لتوسيع الزراعة الأحادية.",
      evidence: [
        "توثيق احتيال سجل الأراضي من قبل المدعين الفيدراليين",
        "سلسلة صحافة استقصائية لوسيلة إعلامية كبرى",
        "شهادة 12 عائلة مهجّرة",
      ],
      rightOfResponse: "تنكر الشركة جميع الاتهامات. وتزعم أن جميع عمليات الاستيلاء على الأراضي كانت قانونية.",
      countryDataRef: "نتيجة CPI: 36/100 · مؤشر الفساد السياسي: 0.55",
    },
    ru: {
      subject: "[REDACTED] — генеральный директор, [ТРАНСНАЦИОНАЛЬНАЯ АГРОКОРПОРАЦИЯ]",
      accusation: "Систематический захват земель у коренных общин. Использование военизированных групп для насильственного переселения традиционного населения ради расширения монокультурного земледелия.",
      evidence: [
        "Документация федеральных прокуроров о мошенничестве с земельным реестром",
        "Серия журналистских расследований крупного СМИ",
        "Показания 12 переселённых семей",
      ],
      rightOfResponse: "Компания отвергает все обвинения. Утверждает, что все земельные приобретения были законными.",
      countryDataRef: "Индекс CPI: 36/100 · Индекс политической коррупции: 0.55",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     REG-003 — [REDACTED] Governor, Haiti
     ═══════════════════════════════════════════════════════════════ */
  "REG-003": {
    en: {
      subject: "[REDACTED] — Governor, [PROVINCE]",
      accusation: "Systematic embezzlement of international earthquake relief funds. Diverted construction materials to personal business empire. At least $12M in aid unaccounted for.",
      evidence: [
        "Audit report by international oversight body",
        "Bank records obtained by judicial authorities",
        "Criminal conviction (2024)",
        "Investigative documentary with leaked documents",
      ],
      rightOfResponse: "Convicted. Appealing sentence.",
      countryDataRef: "CPI Score: 11/100 · HDI Category: Low · Hotspot: YES",
    },
    pt: {
      subject: "[REDACTED] — Governador, [PROVÍNCIA]",
      accusation: "Desvio sistemático de fundos internacionais de socorro a vítimas de terremoto. Desviou materiais de construção para império comercial pessoal. Pelo menos $12M em ajuda sem prestação de contas.",
      evidence: [
        "Relatório de auditoria de órgão internacional de supervisão",
        "Registros bancários obtidos por autoridades judiciais",
        "Condenação criminal (2024)",
        "Documentário investigativo com documentos vazados",
      ],
      rightOfResponse: "Condenado. Recorrendo da sentença.",
      countryDataRef: "Pontuação IPC: 11/100 · Categoria IDH: Baixo · Zona crítica: SIM",
    },
    es: {
      subject: "[REDACTED] — Gobernador, [PROVINCIA]",
      accusation: "Desvío sistemático de fondos internacionales de ayuda por terremoto. Desvió materiales de construcción a su imperio comercial personal. Al menos $12M en ayuda sin justificar.",
      evidence: [
        "Informe de auditoría de organismo internacional de supervisión",
        "Registros bancarios obtenidos por autoridades judiciales",
        "Condena penal (2024)",
        "Documental de investigación con documentos filtrados",
      ],
      rightOfResponse: "Condenado. Apelando la sentencia.",
      countryDataRef: "Puntuación IPC: 11/100 · Categoría IDH: Bajo · Zona crítica: SÍ",
    },
    fr: {
      subject: "[REDACTED] — Gouverneur, [PROVINCE]",
      accusation: "Détournement systématique des fonds internationaux de secours post-séisme. Détournement de matériaux de construction vers son empire commercial personnel. Au moins 12 M$ d'aide non justifiés.",
      evidence: [
        "Rapport d'audit d'un organisme international de surveillance",
        "Relevés bancaires obtenus par les autorités judiciaires",
        "Condamnation pénale (2024)",
        "Documentaire d'investigation avec documents divulgués",
      ],
      rightOfResponse: "Condamné. Fait appel de la sentence.",
      countryDataRef: "Score IPC: 11/100 · Catégorie IDH: Faible · Zone critique: OUI",
    },
    zh: {
      subject: "[REDACTED] — 省长，[省]",
      accusation: "系统性挪用国际地震救灾资金。将建筑材料转移至个人商业帝国。至少1200万美元援助资金下落不明。",
      evidence: [
        "国际监督机构的审计报告",
        "司法机构获取的银行记录",
        "刑事定罪（2024年）",
        "含泄露文件的调查纪录片",
      ],
      rightOfResponse: "已被定罪。正在上诉。",
      countryDataRef: "清廉指数得分: 11/100 · 人类发展指数类别: 低 · 热点: 是",
    },
    ja: {
      subject: "[REDACTED] — 知事、[州]",
      accusation: "国際的な地震救援資金の組織的横領。建設資材を個人の商業帝国に流用。少なくとも1200万ドルの援助が説明されていない。",
      evidence: [
        "国際監視機関による監査報告書",
        "司法当局が入手した銀行記録",
        "刑事有罪判決（2024年）",
        "リークされた文書を含む調査ドキュメンタリー",
      ],
      rightOfResponse: "有罪判決。判決を控訴中。",
      countryDataRef: "CPIスコア: 11/100 · HDIカテゴリ: 低 · ホットスポット: はい",
    },
    ko: {
      subject: "[REDACTED] — 주지사, [주]",
      accusation: "국제 지진 구호 자금의 조직적 횡령. 건설 자재를 개인 사업 제국으로 전용. 최소 1,200만 달러의 원조 행방불명.",
      evidence: [
        "국제 감독 기관의 감사 보고서",
        "사법 당국이 확보한 은행 기록",
        "형사 유죄 판결(2024년)",
        "유출된 문서가 포함된 조사 다큐멘터리",
      ],
      rightOfResponse: "유죄 판결. 항소 중.",
      countryDataRef: "CPI 점수: 11/100 · HDI 범주: 낮음 · 핫스팟: 예",
    },
    hi: {
      subject: "[REDACTED] — राज्यपाल, [प्रांत]",
      accusation: "अंतर्राष्ट्रीय भूकंप राहत कोष का व्यवस्थित गबन। निर्माण सामग्री को व्यक्तिगत व्यवसाय साम्राज्य में मोड़ा। कम से कम $12M की सहायता का कोई हिसाब नहीं।",
      evidence: [
        "अंतर्राष्ट्रीय निगरानी निकाय की ऑडिट रिपोर्ट",
        "न्यायिक अधिकारियों द्वारा प्राप्त बैंक रिकॉर्ड",
        "आपराधिक दोषसिद्धि (2024)",
        "लीक किए गए दस्तावेजों के साथ जांच वृत्तचित्र",
      ],
      rightOfResponse: "दोषी करार। सजा पर अपील की।",
      countryDataRef: "CPI स्कोर: 11/100 · एचडीआई श्रेणी: निम्न · हॉटस्पॉट: हां",
    },
    ar: {
      subject: "[REDACTED] — محافظ، [مقاطعة]",
      accusation: "اختلاس منهجي للأموال الدولية للإغاثة من الزلزال. تحويل مواد البناء إلى إمبراطوريته التجارية الشخصية. ما لا يقل عن 12 مليون دولار من المساعدات غير مبررة.",
      evidence: [
        "تقرير تدقيق من هيئة دولية للإشراف",
        "سجلات بنكية حصلت عليها السلطات القضائية",
        "إدانة جنائية (2024)",
        "فيلم وثائقي استقصائي مع وثائق مسرّبة",
      ],
      rightOfResponse: "أُدين. يستأنف الحكم.",
      countryDataRef: "نتيجة CPI: 11/100 · فئة HDI: منخفض · نقطة ساخنة: نعم",
    },
    ru: {
      subject: "[REDACTED] — губернатор, [ПРОВИНЦИЯ]",
      accusation: "Систематическое хищение международных средств для помощи пострадавшим от землетрясения. Перенаправление строительных материалов в личную коммерческую империю. По крайней мере 12 млн долларов помощи не подотчётны.",
      evidence: [
        "Аудиторский отчёт международного надзорного органа",
        "Банковские записи, полученные судебными органами",
        "Уголовное осуждение (2024)",
        "Документальный фильм-расследование с утечкой документов",
      ],
      rightOfResponse: "Осуждён. Подал апелляцию на приговор.",
      countryDataRef: "Индекс CPI: 11/100 · Категория ИЧР: Низкий · Очаг: ДА",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     REG-004 — [REDACTED] Military Commander, Myanmar
     ═══════════════════════════════════════════════════════════════ */
  "REG-004": {
    en: {
      subject: "[REDACTED] — Military Commander, [REGION]",
      accusation: "Command responsibility for systematic attacks on civilian villages including deliberate burning of food stores, livestock, and agricultural infrastructure as tactic of ethnic cleansing.",
      evidence: [
        "UN Human Rights Council fact-finding mission report",
        "ICJ provisional measures order referencing attacks",
        "Testimony of 200+ refugees in Bangladesh camps",
      ],
      rightOfResponse: "No response offered",
      countryDataRef: "Conflict intensity: 4/5 · Displacement: 1.2M · Democracy Index: 0.080",
    },
    pt: {
      subject: "[REDACTED] — Comandante Militar, [REGIÃO]",
      accusation: "Responsabilidade de comando por ataques sistemáticos a aldeias civis, incluindo a queima deliberada de armazéns de alimentos, gado e infraestrutura agrícola como tática de limpeza étnica.",
      evidence: [
        "Relatório da missão de apuração de fatos do Conselho de Direitos Humanos da ONU",
        "Ordem de medidas provisórias da CIJ referenciando os ataques",
        "Testemunho de mais de 200 refugiados em campos de Bangladesh",
      ],
      rightOfResponse: "Nenhuma resposta oferecida",
      countryDataRef: "Intensidade do conflito: 4/5 · Deslocamento: 1.2M · Índice de Democracia: 0.080",
    },
    es: {
      subject: "[REDACTED] — Comandante Militar, [REGIÓN]",
      accusation: "Responsabilidad de mando por ataques sistemáticos a aldeas civiles, incluyendo la quema deliberada de almacenes de alimentos, ganado e infraestructura agrícola como táctica de limpieza étnica.",
      evidence: [
        "Informe de la misión de determinación de hechos del Consejo de Derechos Humanos de la ONU",
        "Orden de medidas provisionales de la CIJ que hace referencia a los ataques",
        "Testimonio de más de 200 refugiados en campos de Bangladés",
      ],
      rightOfResponse: "Ninguna respuesta ofrecida",
      countryDataRef: "Intensidad del conflicto: 4/5 · Desplazamiento: 1.2M · Índice de Democracia: 0.080",
    },
    fr: {
      subject: "[REDACTED] — Commandant militaire, [RÉGION]",
      accusation: "Responsabilité du commandement pour des attaques systématiques contre des villages civils, y compris l'incendie délibéré de réserves alimentaires, de bétail et d'infrastructures agricoles comme tactique de nettoyage ethnique.",
      evidence: [
        "Rapport de la mission d'établissement des faits du Conseil des droits de l'homme de l'ONU",
        "Ordonnance de mesures provisoires de la CIJ faisant référence aux attaques",
        "Témoignage de plus de 200 réfugiés dans des camps au Bangladesh",
      ],
      rightOfResponse: "Aucune réponse offerte",
      countryDataRef: "Intensité du conflit: 4/5 · Déplacement: 1.2M · Indice de Démocratie: 0.080",
    },
    zh: {
      subject: "[REDACTED] — 军事指挥官，[地区]",
      accusation: "对系统性袭击平民村庄负有指挥责任，包括蓄意焚烧粮食储备、牲畜和农业基础设施，作为种族清洗的策略。",
      evidence: [
        "联合国人权理事会事实调查团报告",
        "国际法院援引袭击事件的临时措施命令",
        "孟加拉国难民营中200多名难民的证词",
      ],
      rightOfResponse: "未提出任何回应",
      countryDataRef: "冲突强度: 4/5 · 流离失所: 1.2M · 民主指数: 0.080",
    },
    ja: {
      subject: "[REDACTED] — 軍司令官、[地域]",
      accusation: "民間人の村々に対する組織的攻撃に対する指揮責任。民族浄化の戦術としての食糧貯蔵、家畜、農業インフラの意図的な焼却を含む。",
      evidence: [
        "国連人権理事会の事実調査ミッション報告書",
        "攻撃を引用したICJの暫定措置命令",
        "バングラデシュのキャンプにおける200人以上の難民の証言",
      ],
      rightOfResponse: "回答の申し出なし",
      countryDataRef: "紛争の激しさ: 4/5 · 避難者数: 1.2M · 民主主義指数: 0.080",
    },
    ko: {
      subject: "[REDACTED] — 군사 지휘관, [지역]",
      accusation: "민간인 마을에 대한 조직적 공격에 대한 지휘 책임. 민족 청소 전술로서 식량 저장고, 가축 및 농업 인프라의 의도적 방화를 포함.",
      evidence: [
        "유엔 인권이사회 진실조사 임무 보고서",
        "공격을 언급한 ICJ 잠정 조치 명령",
        "방글라데시 캠프의 200명 이상 난민의 증언",
      ],
      rightOfResponse: "제출된 답변 없음",
      countryDataRef: "갈등 강도: 4/5 · 실향민: 1.2M · 민주주의 지수: 0.080",
    },
    hi: {
      subject: "[REDACTED] — सैन्य कमांडर, [क्षेत्र]",
      accusation: "नागरिक गांवों पर व्यवस्थित हमलों के लिए कमांड जिम्मेदारी। जातीय सफाई की रणनीति के रूप में खाद्य भंडार, पशुधन और कृषि बुनियादी ढांचे की जानबूझकर आग लगाना शामिल।",
      evidence: [
        "संयुक्त राष्ट्र मानवाधिकार परिषद के तथ्य-खोज मिशन की रिपोर्ट",
        "हमलों का संदर्भ देते हुए ICJ की अंतरिम उपाय आदेश",
        "बांग्लादेश शिविरों में 200+ शरणार्थियों का गवाह बयान",
      ],
      rightOfResponse: "कोई प्रतिक्रिया नहीं दी गई",
      countryDataRef: "संघर्ष की तीव्रता: 4/5 · विस्थापन: 1.2M · लोकतंत्र सूचकांक: 0.080",
    },
    ar: {
      subject: "[REDACTED] — قائد عسكري، [منطقة]",
      accusation: "مسؤولية القيادة عن هجمات منهجية على القرى المدنية، بما في ذلك الحرق المتعمد لمخازن الأغذية والماشية والبنية التحتية الزراعية كتكتيك للتطهير العرقي.",
      evidence: [
        "تقرير بعثة توضيح الحقائق لمجلس حقوق الإنسان التابع للأمم المتحدة",
        "أمر تدابير مؤقتة من محكمة العدل الدولية يشير إلى الهجمات",
        "شهادة أكثر من 200 لاجئ في مخيمات بنغلاديش",
      ],
      rightOfResponse: "لم يتم تقديم أي رد",
      countryDataRef: "شدة الصراع: 4/5 · النزوح: 1.2M · مؤشر الديمقراطية: 0.080",
    },
    ru: {
      subject: "[REDACTED] — военный командир, [РЕГИОН]",
      accusation: "Командная ответственность за систематические нападения на гражданские деревни, включая преднамеренное сожранение запасов продовольствия, скота и сельскохозяйственной инфраструктуры как тактику этнической чистки.",
      evidence: [
        "Доклад миссии Совета ООН по правам человека по установлению фактов",
        "Распоряжение о временных мерах МСУ, ссылающееся на нападения",
        "Показания более 200 беженцев в лагерях Бангладеш",
      ],
      rightOfResponse: "Ответ не предоставлен",
      countryDataRef: "Интенсивность конфликта: 4/5 · Перемещение: 1.2M · Индекс демократии: 0.080",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     REG-005 — [REDACTED] Corporate Board, Extractive Corp, DRC
     ═══════════════════════════════════════════════════════════════ */
  "REG-005": {
    en: {
      subject: "[REDACTED] — Corporate Board, [EXTRACTIVE CORP]",
      accusation: "Illegal mining operations causing mass deforestation and mercury contamination of water sources serving 50,000+ people. Collusion with armed groups to secure mining concessions.",
      evidence: [
        "Environmental NGO investigation with water sample analysis",
        "Community leader testimony (4 sources)",
      ],
      rightOfResponse: "Pending — 72h cooldown active",
      countryDataRef: "Forest area: 55.6% · Hotspot: YES · CPI: 20/100",
    },
    pt: {
      subject: "[REDACTED] — Conselho de Administração, [CORP EXTRATIVA]",
      accusation: "Operações de mineração ilegal causando desmatamento em massa e contaminação por mercúrio de fontes de água que servem mais de 50.000 pessoas. Conluio com grupos armados para garantir concessões de mineração.",
      evidence: [
        "Investigação de ONG ambiental com análise de amostras de água",
        "Testemunho de líder comunitário (4 fontes)",
      ],
      rightOfResponse: "Pendente — período de espera de 72h ativo",
      countryDataRef: "Área florestal: 55.6% · Zona crítica: SIM · CPI: 20/100",
    },
    es: {
      subject: "[REDACTED] — Junta Directiva, [CORP EXTRACTIVA]",
      accusation: "Operaciones mineras ilegales que causan deforestación masiva y contaminación por mercurio de fuentes de agua que sirven a más de 50.000 personas. Colusión con grupos armados para asegurar concesiones mineras.",
      evidence: [
        "Investigación de ONG ambiental con análisis de muestras de agua",
        "Testimonio de líder comunitario (4 fuentes)",
      ],
      rightOfResponse: "Pendiente — enfriamiento de 72h activo",
      countryDataRef: "Área forestal: 55.6% · Zona crítica: SÍ · CPI: 20/100",
    },
    fr: {
      subject: "[REDACTED] — Conseil d'administration, [CORP EXTRACTIVE]",
      accusation: "Opérations minières illégales causant une déforestation massive et une contamination au mercure des sources d'eau desservant plus de 50 000 personnes. Collusion avec des groupes armés pour sécuriser des concessions minières.",
      evidence: [
        "Enquête d'ONG environnementale avec analyse d'échantillons d'eau",
        "Témoignage de dirigeant communautaire (4 sources)",
      ],
      rightOfResponse: "En attente — délai de 72 h actif",
      countryDataRef: "Zone forestière: 55.6% · Zone critique: OUI · CPI: 20/100",
    },
    zh: {
      subject: "[REDACTED] — 公司董事会，[采矿公司]",
      accusation: "非法采矿作业造成大规模森林砍伐，并导致服务于5万多人的水源受到汞污染。与武装团体勾结以获取采矿特许权。",
      evidence: [
        "环保非政府组织的调查，包含水质样本分析",
        "社区领袖证词（4个来源）",
      ],
      rightOfResponse: "待处理 — 72小时冷却期有效",
      countryDataRef: "森林面积: 55.6% · 热点: 是 · CPI: 20/100",
    },
    ja: {
      subject: "[REDACTED] — 取締役会、[資源採掘企業]",
      accusation: "大規模な森林破壊と5万人以上が利用する水源の水銀汚染を引き起こす違法な採掘作業。採鉱権益を確保するための武装集団との結託。",
      evidence: [
        "水質サンプル分析を含む環境NGOの調査",
        "コミュニティ指導者の証言（4つの情報源）",
      ],
      rightOfResponse: "保留中 — 72時間のクールダウン期間が進行中",
      countryDataRef: "森林面積: 55.6% · ホットスポット: はい · CPI: 20/100",
    },
    ko: {
      subject: "[REDACTED] — 이사회, [채굴 기업]",
      accusation: "대규모 산림 파괴와 5만 명 이상이 사용하는 수원의 수은 오염을 유발하는 불법 채굴 작업. 채굴 허가를 확보하기 위해 무장 단체와 결탁.",
      evidence: [
        "수질 샘플 분석이 포함된 환경 NGO 조사",
        "지역사회 지도자의 증언(4개 출처)",
      ],
      rightOfResponse: "대기 중 — 72시간 대기 기간 활성화",
      countryDataRef: "산림 면적: 55.6% · 핫스팟: 예 · CPI: 20/100",
    },
    hi: {
      subject: "[REDACTED] — निगम बोर्ड, [खनन निगम]",
      accusation: "अवैध खनन संचालन के कारण बड़े पैमाने पर वनों की कटाई और 50,000+ लोगों की आपूर्ति करने वाले जल स्रोतों का पारा संदूषण। खनन रियायतों को सुरक्षित करने के लिए सशस्त्र समूहों के साथ मिलीभगत।",
      evidence: [
        "जल नमूना विश्लेषण के साथ पर्यावरण एनजीओ जांच",
        "सामुदायिक नेता का गवाह बयान (4 स्रोत)",
      ],
      rightOfResponse: "लंबित — 72घंटे प्रतीक्षा अवधि सक्रिय",
      countryDataRef: "वन क्षेत्र: 55.6% · हॉटस्पॉट: हां · CPI: 20/100",
    },
    ar: {
      subject: "[REDACTED] — مجلس إدارة الشركة، [شركة استخراجية]",
      accusation: "عمليات تعدين غير قانونية تسبب إزالة الغابات الجماعية وتلوث مصادر المياه التي تخدم أكثر من 50,000 شخص بالزئبق. تواطؤ مع الجماعات المسلحة لتأمين امتيازات التعدين.",
      evidence: [
        "تحقيق منظمة غير حكومية بيئية مع تحليل عينات المياه",
        "شهادة قائد مجتمعي (4 مصادر)",
      ],
      rightOfResponse: "قيد الانتظار — فترة انتظار 72 ساعة سارية",
      countryDataRef: "مساحة الغابات: 55.6% · نقطة ساخنة: نعم · CPI: 20/100",
    },
    ru: {
      subject: "[REDACTED] — совет директоров, [ДОБЫВАЮЩАЯ КОРПОРАЦИЯ]",
      accusation: "Незаконные горнодобывающие операции, вызывающие массовую вырубку лесов и загрязнение ртутью источников воды, обслуживающих более 50 000 человек. Сговор с вооружёнными группами для получения горнодобывающих концессий.",
      evidence: [
        "Расследование экологической НПО с анализом образцов воды",
        "Показания лидера общины (4 источника)",
      ],
      rightOfResponse: "Ожидает — активен период ожидания 72 часа",
      countryDataRef: "Лесистость: 55.6% · Очаг: ДА · CPI: 20/100",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-01 — Vladimir Putin
     ═══════════════════════════════════════════════════════════════ */
  "ICC-01": {
    en: {
      subject: "Vladimir Putin — President of the Russian Federation [RUS]",
      accusation: "ICC arrest warrant (ICC-02/23-01, issued 17 March 2023) for unlawful deportation of children from occupied areas of Ukraine to the Russian Federation. The war crimes include the unlawful deportation of population and the unlawful transfer of population from occupied territories.",
      evidence: [
        "ICC Pre-Trial Chamber II arrest warrant (17 March 2023), case ICC-02/23-01",
        "UN Commission of Inquiry on Ukraine report documenting systematic child deportations (March 2023)",
        "Yale Humanitarian Research Lab geospatial analysis confirming at least 6,000 children relocated to camps (February 2023)",
      ],
      rightOfResponse: "The Russian Federation rejects ICC jurisdiction and denies the charges. Russia is not a party to the Rome Statute.",
      countryDataRef: "Undernourishment: 2.5%",
    },
    pt: {
      subject: "Vladimir Putin — Presidente da Federação Russa [RUS]",
      accusation: "Mandado de prisão do TPI (ICC-02/23-01, emitido em 17 de março de 2023) por deportação ilegal de crianças de áreas ocupadas da Ucrânia para a Federação Russa. Os crimes de guerra incluem a deportação ilegal de população e a transferência ilegal de população de territórios ocupados.",
      evidence: [
        "Mandado de prisão da Câmara de Instrução II do TPI (17 de março de 2023), caso ICC-02/23-01",
        "Relatório da Comissão de Inquérito da ONU sobre a Ucrânia documentando deportações sistemáticas de crianças (março de 2023)",
        "Análise geoespacial do Yale Humanitarian Research Lab confirmando pelo menos 6.000 crianças transferidas para acampamentos (fevereiro de 2023)",
      ],
      rightOfResponse: "A Federação Russa rejeita a jurisdição do TPI e nega as acusações. A Rússia não é parte do Estatuto de Roma.",
      countryDataRef: "Subnutrição: 2.5%",
    },
    es: {
      subject: "Vladimir Putin — Presidente de la Federación de Rusia [RUS]",
      accusation: "Orden de arresto de la CPI (ICC-02/23-01, emitida el 17 de marzo de 2023) por deportación ilegal de niños de áreas ocupadas de Ucrania a la Federación de Rusia. Los crímenes de guerra incluyen la deportación ilegal de población y la transferencia ilegal de población de territorios ocupados.",
      evidence: [
        "Orden de arresto de la Sala de Cuestiones Preliminares II de la CPI (17 de marzo de 2023), caso ICC-02/23-01",
        "Informe de la Comisión de Investigación de la ONU sobre Ucrania documentando deportaciones sistemáticas de niños (marzo de 2023)",
        "Análisis geoespacial del Yale Humanitarian Research Lab confirmando al menos 6.000 niños trasladados a campamentos (febrero de 2023)",
      ],
      rightOfResponse: "La Federación de Rusia rechaza la jurisdicción de la CPI y niega los cargos. Rusia no es parte del Estatuto de Roma.",
      countryDataRef: "Desnutrición: 2.5%",
    },
    fr: {
      subject: "Vladimir Putin — Président de la Fédération de Russie [RUS]",
      accusation: "Mandat d'arrêt de la CPI (ICC-02/23-01, délivré le 17 mars 2023) pour déportation illégale d'enfants des zones occupées d'Ukraine vers la Fédération de Russie. Les crimes de guerre incluent la déportation illégale de population et le transfert illégal de population des territoires occupés.",
      evidence: [
        "Mandat d'arrêt de la Chambre préliminaire II de la CPI (17 mars 2023), affaire ICC-02/23-01",
        "Rapport de la Commission d'enquête de l'ONU sur l'Ukraine documentant les déportations systématiques d'enfants (mars 2023)",
        "Analyse géospatiale du Yale Humanitarian Research Lab confirmant au moins 6 000 enfants relocalisés dans des camps (février 2023)",
      ],
      rightOfResponse: "La Fédération de Russie rejette la juridiction de la CPI et nie les accusations. La Russie n'est pas partie au Statut de Rome.",
      countryDataRef: "Sous-alimentation: 2.5%",
    },
    zh: {
      subject: "Vladimir Putin — 俄罗斯联邦总统 [RUS]",
      accusation: "国际刑事法院逮捕令（ICC-02/23-01，2023年3月17日签发），指控非法将儿童从乌克兰被占领区驱逐至俄罗斯联邦。战争罪行包括非法驱逐人口和非法转移被占领领土人口。",
      evidence: [
        "国际刑事法院预审二庭逮捕令（2023年3月17日），案件号ICC-02/23-01",
        "联合国乌克兰调查委员会报告，记录系统性儿童驱逐行为（2023年3月）",
        "耶鲁人道主义研究实验室地理空间分析，确认至少6,000名儿童被转移到营地（2023年2月）",
      ],
      rightOfResponse: "俄罗斯联邦拒绝国际刑事法院管辖权并否认指控。俄罗斯不是《罗马规约》缔约国。",
      countryDataRef: "营养不良率: 2.5%",
    },
    ja: {
      subject: "Vladimir Putin — ロシア連邦大統領 [RUS]",
      accusation: "ICC逮捕状（ICC-02/23-01、2023年3月17日発行）により、ウクライナ占領地域からロシア連邦への子供の不法な強制送還で起訴。戦争犯罪には占領地域からの人口の不法な強制送還および不法な移転が含まれる。",
      evidence: [
        "ICC予備審問法廷IIの逮捕状（2023年3月17日）、事件ICC-02/23-01",
        "ウクライナに関する国連調査委員会報告書、組織的な子供の強制送還を記録（2023年3月）",
        "イェール人道研究ラボの地理空間分析、少なくとも6,000人の子供がキャンプに再配置されたことを確認（2023年2月）",
      ],
      rightOfResponse: "ロシア連邦はICCの管轄権を拒否し、容疑を否定。ロシアはローマ規程の締約国ではない。",
      countryDataRef: "栄養不良率: 2.5%",
    },
    ko: {
      subject: "Vladimir Putin — 러시아 연방 대통령 [RUS]",
      accusation: "ICC 체포영장(ICC-02/23-01, 2023년 3월 17일 발부)으로 우크라이나 점령 지역에서 러시아 연방으로 아동을 불법 강제 추방. 전쟁 범죄에는 점령 영토에서의 인구 불법 추방 및 인구 불법 이전이 포함됨.",
      evidence: [
        "ICC 예심재판부 II 체포영장(2023년 3월 17일), 사건 ICC-02/23-01",
        "우크라이나 관련 유엔 조사위원회 보고서, 체계적인 아동 강제 추방 기록(2023년 3월)",
        "예일 인도적 연구소 지리공간 분석, 최소 6,000명의 아동이 캠프로 이전된 것 확인(2023년 2월)",
      ],
      rightOfResponse: "러시아 연방은 ICC 관할권을 거부하고 혐의를 부인함. 러시아는 로마규정 당사국이 아님.",
      countryDataRef: "영양부족률: 2.5%",
    },
    hi: {
      subject: "Vladimir Putin — रूसी संघ के राष्ट्रपति [RUS]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-02/23-01, 17 मार्च 2023 को जारी) यूक्रेन के कब्जे वाले क्षेत्रों से बच्चों को रूसी संघ में गैरकानूनी रूप से निर्वासित करने के लिए। युद्ध अपराधों में कब्जे वाले क्षेत्रों से आबादी का गैरकानूनी निर्वासन और आबादी का गैरकानूनी स्थानांतरण शामिल है।",
      evidence: [
        "ICC प्राथमिकी चैम्बर II गिरफ्तारी वारंट (17 मार्च 2023), मामला ICC-02/23-01",
        "यूक्रेन पर संयुक्त राष्ट्र जांच आयोग की रिपोर्ट व्यवस्थित बाल निर्वासन का दस्तावेजीकरण (मार्च 2023)",
        "येल ह्यूमैनिटेरियन रिसर्च लैब का भू-स्थानिक विश्लेषण, कम से कम 6,000 बच्चों को शिविरों में स्थानांतरित किए जाने की पुष्टि (फरवरी 2023)",
      ],
      rightOfResponse: "रूसी संघ ICC क्षेत्राधिकार को अस्वीकार करता है और आरोपों से इनकार करता है। रूस रोम संविधान का पक्ष नहीं है।",
      countryDataRef: "कुपोषण: 2.5%",
    },
    ar: {
      subject: "Vladimir Putin — رئيس الاتحاد الروسي [RUS]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-02/23-01، صادرة في 17 مارس 2023) بسبب الترحيل غير القانوني للأطفال من المناطق المحتلة في أوكرانيا إلى الاتحاد الروسي. تشمل جرائم الحرب الترحيل غير القانوني للسكان والنقل غير القانوني للسكان من الأراضي المحتلة.",
      evidence: [
        "مذكرة توقيف من الدائرة التمهيدية الثانية للمحكمة الجنائية الدولية (17 مارس 2023)، القضية ICC-02/23-01",
        "تقرير لجنة التحقيق التابعة للأمم المتحدة في أوكرانيا يوثق الترحيل المنهجي للأطفال (مارس 2023)",
        "تحليل جغرافي مكاني من مختبر ييل للأبحاث الإنسانية يؤكد نقل 6,000 طفل على الأقل إلى مخيمات (فبراير 2023)",
      ],
      rightOfResponse: "يرفض الاتحاد الروسي ولاية المحكمة الجنائية الدولية وينفي التهم. روسيا ليست طرفاً في نظام روما الأساسي.",
      countryDataRef: "سوء التغذية: 2.5%",
    },
    ru: {
      subject: "Vladimir Putin — Президент Российской Федерации [RUS]",
      accusation: "Ордер на арест МУС (ICC-02/23-01, выдан 17 марта 2023 г.) за незаконную депортацию детей из оккупированных районов Украины в Российскую Федерацию. Военные преступления включают незаконную депортацию населения и незаконное перемещение населения с оккупированных территорий.",
      evidence: [
        "Ордер на арест Суда предварительного разбирательства II МУС (17 марта 2023 г.), дело ICC-02/23-01",
        "Доклад Комиссии ООН по расследованию событий в Украине, зафиксировавший систематическую депортацию детей (март 2023 г.)",
        "Геопространственный анализ Лаборатории гуманитарных исследований Йеля, подтвердивший перемещение не менее 6 000 детей в лагеря (февраль 2023 г.)",
      ],
      rightOfResponse: "Российская Федерация отвергает юрисдикцию МУС и отрицает обвинения. Россия не является участником Римского статута.",
      countryDataRef: "Недоедание: 2.5%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-02 — Maria Lvova-Belova
     ═══════════════════════════════════════════════════════════════ */
  "ICC-02": {
    en: {
      subject: "Maria Lvova-Belova — Russian Presidential Commissioner for Children's Rights [RUS]",
      accusation: "ICC arrest warrant (ICC-02/23-02, issued 17 March 2023) for the war crime of unlawful deportation of children and unlawful transfer of population from occupied areas of Ukraine to the Russian Federation.",
      evidence: [
        "ICC Pre-Trial Chamber II arrest warrant (17 March 2023), case ICC-02/23-02",
        "Lvova-Belova's own public statements confirming the relocation program, including televised interviews (2022-2023)",
      ],
      rightOfResponse: "Lvova-Belova has publicly stated the program is a 'rescue' and 'adoption' operation, not deportation.",
      countryDataRef: "Undernourishment: 2.5%",
    },
    pt: {
      subject: "Maria Lvova-Belova — Comissária Presidencial Russa para os Direitos da Criança [RUS]",
      accusation: "Mandado de prisão do TPI (ICC-02/23-02, emitido em 17 de março de 2023) pelo crime de guerra de deportação ilegal de crianças e transferência ilegal de população de áreas ocupadas da Ucrânia para a Federação Russa.",
      evidence: [
        "Mandado de prisão da Câmara de Instrução II do TPI (17 de março de 2023), caso ICC-02/23-02",
        "Declarações públicas da própria Lvova-Belova confirmando o programa de realocação, incluindo entrevistas televisionadas (2022-2023)",
      ],
      rightOfResponse: "Lvova-Belova declarou publicamente que o programa é uma operação de 'resgate' e 'adoção', e não de deportação.",
      countryDataRef: "Subnutrição: 2.5%",
    },
    es: {
      subject: "Maria Lvova-Belova — Comisionada Presidencial Rusa para los Derechos del Niño [RUS]",
      accusation: "Orden de arresto de la CPI (ICC-02/23-02, emitida el 17 de marzo de 2023) por el crimen de guerra de deportación ilegal de niños y transferencia ilegal de población de áreas ocupadas de Ucrania a la Federación de Rusia.",
      evidence: [
        "Orden de arresto de la Sala de Cuestiones Preliminares II de la CPI (17 de marzo de 2023), caso ICC-02/23-02",
        "Declaraciones públicas de la propia Lvova-Belova confirmando el programa de reubicación, incluyendo entrevistas televisadas (2022-2023)",
      ],
      rightOfResponse: "Lvova-Belova ha declarado públicamente que el programa es una operación de 'rescate' y 'adopción', no de deportación.",
      countryDataRef: "Desnutrición: 2.5%",
    },
    fr: {
      subject: "Maria Lvova-Belova — Commissaire présidentielle russe pour les droits de l'enfant [RUS]",
      accusation: "Mandat d'arrêt de la CPI (ICC-02/23-02, délivré le 17 mars 2023) pour le crime de guerre de déportation illégale d'enfants et transfert illégal de population des zones occupées d'Ukraine vers la Fédération de Russie.",
      evidence: [
        "Mandat d'arrêt de la Chambre préliminaire II de la CPI (17 mars 2023), affaire ICC-02/23-02",
        "Déclarations publiques de Lvova-Belova elle-même confirmant le programme de relocalisation, y compris des interviews télévisées (2022-2023)",
      ],
      rightOfResponse: "Lvova-Belova a déclaré publiquement que le programme est une opération de 'sauvetage' et d' 'adoption', et non de déportation.",
      countryDataRef: "Sous-alimentation: 2.5%",
    },
    zh: {
      subject: "Maria Lvova-Belova — 俄罗斯总统儿童权利专员 [RUS]",
      accusation: "国际刑事法院逮捕令（ICC-02/23-02，2023年3月17日签发），指控将儿童非法驱逐及非法转移乌克兰被占领区人口至俄罗斯联邦的战争罪。",
      evidence: [
        "国际刑事法院预审二庭逮捕令（2023年3月17日），案件号ICC-02/23-02",
        "Lvova-Belova本人公开声明确认搬迁计划，包括电视采访（2022-2023）",
      ],
      rightOfResponse: "Lvova-Belova公开表示该计划是\u201c救援\u201d和\u201c领养\u201d行动，而非驱逐。",
      countryDataRef: "营养不良率: 2.5%",
    },
    ja: {
      subject: "Maria Lvova-Belova — ロシア大統領附属子供の権利委員 [RUS]",
      accusation: "ICC逮捕状（ICC-02/23-02、2023年3月17日発行）により、ウクライナ占領地域からロシア連邦への子供の不法な強制送還および人口の不法な移転の戦争犯罪で起訴。",
      evidence: [
        "ICC予備審問法廷IIの逮捕状（2023年3月17日）、事件ICC-02/23-02",
        "Lvova-Belova自身の公開声明による再配置プログラムの確認、テレビインタビューを含む（2022-2023年）",
      ],
      rightOfResponse: "Lvova-Belovaは公開の場で、このプログラムは「救出」および「養子縁組」作戦であり、強制送還ではないと述べた。",
      countryDataRef: "栄養不良率: 2.5%",
    },
    ko: {
      subject: "Maria Lvova-Belova — 러시아 대통령 아동권리특사 [RUS]",
      accusation: "ICC 체포영장(ICC-02/23-02, 2023년 3월 17일 발부)으로 우크라이나 점령 지역에서 러시아 연방으로 아동을 불법 강제 추방하고 인구를 불법 이전한 전쟁 범죄.",
      evidence: [
        "ICC 예심재판부 II 체포영장(2023년 3월 17일), 사건 ICC-02/23-02",
        "Lvova-Belova 본인의 공개 성명, 재배치 프로그램 확인, TV 인터뷰 포함(2022-2023년)",
      ],
      rightOfResponse: "Lvova-Belova는 공개적으로 이 프로그램이 '구조' 및 '입양' 작전이지 추방이 아니라고 밝힘.",
      countryDataRef: "영양부족률: 2.5%",
    },
    hi: {
      subject: "Maria Lvova-Belova — रूसी राष्ट्रपति बाल अधिकार आयुक्त [RUS]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-02/23-02, 17 मार्च 2023 को जारी) यूक्रेन के कब्जे वाले क्षेत्रों से बच्चों के गैरकानूनी निर्वासन और आबादी के गैरकानूनी स्थानांतरण के युद्ध अपराध के लिए।",
      evidence: [
        "ICC प्राथमिकी चैम्बर II गिरफ्तारी वारंट (17 मार्च 2023), मामला ICC-02/23-02",
        "Lvova-Belova के अपने सार्वजनिक बयान, पुनर्स्थापना कार्यक्रम की पुष्टि, टेलीविजन साक्षात्कार सहित (2022-2023)",
      ],
      rightOfResponse: "Lvova-Belova ने सार्वजनिक रूप से कहा है कि यह कार्यक्रम 'बचाव' और 'दत्तक' अभियान है, निर्वासन नहीं।",
      countryDataRef: "कुपोषण: 2.5%",
    },
    ar: {
      subject: "Maria Lvova-Belova — المفوضة الرئاسية الروسية لحقوق الطفل [RUS]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-02/23-02، صادرة في 17 مارس 2023) بتهمة جريمة حرب الترحيل غير القانوني للأطفال والنقل غير القانوني للسكان من المناطق المحتلة في أوكرانيا إلى الاتحاد الروسي.",
      evidence: [
        "مذكرة توقيف من الدائرة التمهيدية الثانية للمحكمة الجنائية الدولية (17 مارس 2023)، القضية ICC-02/23-02",
        "تصريحات عامة من Lvova-Belova نفسها تؤكد برنامج إعادة التوطين، بما في ذلك مقابلات تلفزيونية (2022-2023)",
      ],
      rightOfResponse: "صرحت Lvova-Belova علناً أن البرنامج عملية 'إنقاذ' و'تبني' وليس ترحيلاً.",
      countryDataRef: "سوء التغذية: 2.5%",
    },
    ru: {
      subject: "Maria Lvova-Belova — Уполномоченный при Президенте Российской Федерации по правам ребёнка [RUS]",
      accusation: "Ордер на арест МУС (ICC-02/23-02, выдан 17 марта 2023 г.) за военное преступление в виде незаконной депортации детей и незаконного перемещения населения из оккупированных районов Украины в Российскую Федерацию.",
      evidence: [
        "Ордер на арест Суда предварительного разбирательства II МУС (17 марта 2023 г.), дело ICC-02/23-02",
        "Собственные публичные заявления Lvova-Belova, подтверждающие программу переселения, включая телевизионные интервью (2022-2023 гг.)",
      ],
      rightOfResponse: "Lvova-Belova публично заявила, что программа является операцией по «спасению» и «усыновлению», а не депортацией.",
      countryDataRef: "Недоедание: 2.5%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-03 — Benjamin Netanyahu
     ═══════════════════════════════════════════════════════════════ */
  "ICC-03": {
    en: {
      subject: "Benjamin Netanyahu — Prime Minister of Israel [ISR]",
      accusation: "ICC arrest warrant (ICC-01/18, issued 21 November 2024) for crimes against humanity and war crimes, including the war crime of starvation as a method of warfare, the crime against humanity of murder, persecution, and other inhumane acts, committed in the Gaza Strip from at least 8 October 2023.",
      evidence: [
        "ICC Pre-Trial Chamber I arrest warrant (21 November 2024), case ICC-01/18",
        "UN Office for the Coordination of Humanitarian Affairs (OCHA) humanitarian access data documenting systematic aid denial (2024)",
        "Human Rights Watch report 'Threshold of Pain' documenting starvation as weapon (December 2024)",
        "Amnesty International report documenting war crimes in Gaza (December 2024)",
      ],
      rightOfResponse: "Israel rejects ICC jurisdiction and denies all charges. Israel is not a party to the Rome Statute.",
      countryDataRef: "Undernourishment: 2.5%",
    },
    pt: {
      subject: "Benjamin Netanyahu — Primeiro-Ministro de Israel [ISR]",
      accusation: "Mandado de prisão do TPI (ICC-01/18, emitido em 21 de novembro de 2024) por crimes contra a humanidade e crimes de guerra, incluindo o crime de guerra de fome como método de guerra, o crime contra a humanidade de assassinato, perseguição e outros atos desumanos, cometidos na Faixa de Gaza desde pelo menos 8 de outubro de 2023.",
      evidence: [
        "Mandado de prisão da Câmara de Instrução I do TPI (21 de novembro de 2024), caso ICC-01/18",
        "Dados de acesso humanitário do Escritório da ONU para a Coordenação de Assuntos Humanitários (OCHA) documentando negação sistemática de ajuda (2024)",
        "Relatório da Human Rights Watch 'Limiar da Dor' documentando a fome como arma (dezembro de 2024)",
        "Relatório da Anistia Internacional documentando crimes de guerra em Gaza (dezembro de 2024)",
      ],
      rightOfResponse: "Israel rejeita a jurisdição do TPI e nega todas as acusações. Israel não é parte do Estatuto de Roma.",
      countryDataRef: "Subnutrição: 2.5%",
    },
    es: {
      subject: "Benjamin Netanyahu — Primer Ministro de Israel [ISR]",
      accusation: "Orden de arresto de la CPI (ICC-01/18, emitida el 21 de noviembre de 2024) por crímenes de lesa humanidad y crímenes de guerra, incluyendo el crimen de guerra de inanición como método de guerra, el crimen de lesa humanidad de asesinato, persecución y otros actos inhumanos, cometidos en la Franja de Gaza desde al menos el 8 de octubre de 2023.",
      evidence: [
        "Orden de arresto de la Sala de Cuestiones Preliminares I de la CPI (21 de noviembre de 2024), caso ICC-01/18",
        "Datos de acceso humanitario de la Oficina de la ONU para la Coordinación de Asuntos Humanitarios (OCHA) documentando la negación sistemática de ayuda (2024)",
        "Informe de Human Rights Watch 'Umbral del Dolor' documentando la inanición como arma (diciembre de 2024)",
        "Informe de Amnistía Internacional documentando crímenes de guerra en Gaza (diciembre de 2024)",
      ],
      rightOfResponse: "Israel rechaza la jurisdicción de la CPI y niega todos los cargos. Israel no es parte del Estatuto de Roma.",
      countryDataRef: "Desnutrición: 2.5%",
    },
    fr: {
      subject: "Benjamin Netanyahu — Premier ministre d'Israël [ISR]",
      accusation: "Mandat d'arrêt de la CPI (ICC-01/18, délivré le 21 novembre 2024) pour crimes contre l'humanité et crimes de guerre, y compris le crime de guerre de famine comme méthode de guerre, le crime contre l'humanité de meurtre, de persécution et d'autres actes inhumains, commis dans la bande de Gaza depuis au moins le 8 octobre 2023.",
      evidence: [
        "Mandat d'arrêt de la Chambre préliminaire I de la CPI (21 novembre 2024), affaire ICC-01/18",
        "Données d'accès humanitaire du Bureau de la coordination des affaires humanitaires de l'ONU (OCHA) documentant le refus systématique d'aide (2024)",
        "Rapport de Human Rights Watch 'Seuil de la souffrance' documentant la famine comme arme (décembre 2024)",
        "Rapport d'Amnesty International documentant des crimes de guerre à Gaza (décembre 2024)",
      ],
      rightOfResponse: "Israël rejette la juridiction de la CPI et nie toutes les accusations. Israël n'est pas partie au Statut de Rome.",
      countryDataRef: "Sous-alimentation: 2.5%",
    },
    zh: {
      subject: "Benjamin Netanyahu — 以色列总理 [ISR]",
      accusation: "国际刑事法院逮捕令（ICC-01/18，2024年11月21日签发），指控反人类罪和战争罪，包括将饥饿作为战争方法的战争罪、谋杀、迫害和其他不人道行为的反人类罪，自2023年10月8日起在加沙地带实施。",
      evidence: [
        "国际刑事法院预审一庭逮捕令（2024年11月21日），案件号ICC-01/18",
        "联合国人道主义事务协调厅（OCHA）人道主义准入数据，记录系统性拒绝援助（2024年）",
        "人权观察组织报告《痛苦的门槛》，记录饥饿作为武器（2024年12月）",
        "国际特赦组织报告，记录加沙战争罪行（2024年12月）",
      ],
      rightOfResponse: "以色列拒绝国际刑事法院管辖权并否认所有指控。以色列不是《罗马规约》缔约国。",
      countryDataRef: "营养不良率: 2.5%",
    },
    ja: {
      subject: "Benjamin Netanyahu — イスラエル首相 [ISR]",
      accusation: "ICC逮捕状（ICC-01/18、2024年11月21日発行）により、人道に対する犯罪および戦争犯罪で起訴。戦争の手段としての飢餓の戦争犯罪、殺人、迫害、その他の非人道的行為の人道に対する犯罪を含み、2023年10月8日以降ガザ地区で犯された。",
      evidence: [
        "ICC予備審問法廷Iの逮捕状（2024年11月21日）、事件ICC-01/18",
        "国連人道問題調整事務所（OCHA）の人道アクセスデータ、組織的な支援拒否を記録（2024年）",
        "ヒューマン・ライツ・ウォッチの報告書『苦痛の閾値』、飢餓の武器化を記録（2024年12月）",
        "アムネスティ・インターナショナルの報告書、ガザでの戦争犯罪を記録（2024年12月）",
      ],
      rightOfResponse: "イスラエルはICCの管轄権を拒否し、すべての容疑を否定。イスラエルはローマ規程の締約国ではない。",
      countryDataRef: "栄養不良率: 2.5%",
    },
    ko: {
      subject: "Benjamin Netanyahu — 이스라엘 총리 [ISR]",
      accusation: "ICC 체포영장(ICC-01/18, 2024년 11월 21일 발부)으로 반인도적 범죄 및 전쟁 범죄 혐의. 전쟁 수단으로서의 기아라는 전쟁 범죄, 살인, 박해 및 기타 비인도적 행위라는 반인도적 범죄를 포함하며, 2023년 10월 8일 이후 가자지구에서 자행됨.",
      evidence: [
        "ICC 예심재판부 I 체포영장(2024년 11월 21일), 사건 ICC-01/18",
        "유엔 인도적 문제 조정실(OCHA) 인도적 접근 데이터, 체계적 지원 거부 기록(2024년)",
        "휴먼 라이츠 워치 보고서 '고통의 문턱', 기아를 무기로 기록(2024년 12월)",
        "국제사면위원회 보고서, 가자지구 전쟁 범죄 기록(2024년 12월)",
      ],
      rightOfResponse: "이스라엘은 ICC 관할권을 거부하고 모든 혐의를 부인함. 이스라엘은 로마규정 당사국이 아님.",
      countryDataRef: "영양부족률: 2.5%",
    },
    hi: {
      subject: "Benjamin Netanyahu — इज़राइल के प्रधानमंत्री [ISR]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-01/18, 21 नवंबर 2024 को जारी) मानवता के खिलाफ अपराध और युद्ध अपराधों के लिए, जिनमें युद्ध की विधि के रूप में भुखमरी का युद्ध अपराध, हत्या, उत्पीड़न और अन्य अमानवीय कृत्यों का मानवता के खिलाफ अपराध शामिल है, जो कम से कम 8 अक्टूबर 2023 से गाजा पट्टी में किए गए।",
      evidence: [
        "ICC प्राथमिकी चैम्बर I गिरफ्तारी वारंट (21 नवंबर 2024), मामला ICC-01/18",
        "संयुक्त राष्ट्र मानवीय मामलों के समन्वय कार्यालय (OCHA) मानवीय पहुंच डेटा, व्यवस्थित सहायता अस्वीकृति का दस्तावेजीकरण (2024)",
        "ह्यूमन राइट्स वॉच रिपोर्ट 'दर्द की सीमा', भुखमरी को हथियार के रूप में दर्शाती हुई (दिसंबर 2024)",
        "एमनेस्टी इंटरनेशनल रिपोर्ट, गाजा में युद्ध अपराधों का दस्तावेजीकरण (दिसंबर 2024)",
      ],
      rightOfResponse: "इज़राइल ICC क्षेत्राधिकार को अस्वीकार करता है और सभी आरोपों से इनकार करता है। इज़राइल रोम संविधान का पक्ष नहीं है।",
      countryDataRef: "कुपोषण: 2.5%",
    },
    ar: {
      subject: "Benjamin Netanyahu — رئيس وزراء إسرائيل [ISR]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-01/18، صادرة في 21 نوفمبر 2024) بتهمة جرائم ضد الإنسانية وجرائم حرب، بما في ذلك جريمة حرب التجويع كأسلوب حربي، وجريمة ضد الإنسانية المتمثلة في القتل والاضطهاد والأفعال اللاإنسانية الأخرى، المرتكبة في قطاع غزة منذ 8 أكتوبر 2023 على الأقل.",
      evidence: [
        "مذكرة توقيف من الدائرة التمهيدية الأولى للمحكمة الجنائية الدولية (21 نوفمبر 2024)، القضية ICC-01/18",
        "بيانات الوصول الإنساني لمكتب الأمم المتحدة لتنسيق الشؤون الإنسانية (OCHA) توثق الرفض المنهجي للمساعدات (2024)",
        "تقرير هيومن رايتس ووتش 'عتبة الألم' يوثق التجويع كسلاح (ديسمبر 2024)",
        "تقرير منظمة العفو الدولية يوثق جرائم حرب في غزة (ديسمبر 2024)",
      ],
      rightOfResponse: "ترفض إسرائيل ولاية المحكمة الجنائية الدولية وتنفي جميع التهم. إسرائيل ليست طرفاً في نظام روما الأساسي.",
      countryDataRef: "سوء التغذية: 2.5%",
    },
    ru: {
      subject: "Benjamin Netanyahu — Премьер-министр Израиля [ISR]",
      accusation: "Ордер на арест МУС (ICC-01/18, выдан 21 ноября 2024 г.) за преступления против человечности и военные преступления, включая военное преступление в виде использования голода как метода ведения войны, преступление против человечности в виде убийства, преследования и других бесчеловечных актов, совершённых в секторе Газа по меньшей мере с 8 октября 2023 г.",
      evidence: [
        "Ордер на арест Суда предварительного разбирательства I МУС (21 ноября 2024 г.), дело ICC-01/18",
        "Данные о гуманитарном доступе Управления ООН по координации гуманитарных вопросов (OCHA), зафиксировавшие систематический отказ в помощи (2024 г.)",
        "Доклад Human Rights Watch «Порог боли», зафиксировавший использование голода в качестве оружия (декабрь 2024 г.)",
        "Доклад Amnesty International, зафиксировавший военные преступления в Газе (декабрь 2024 г.)",
      ],
      rightOfResponse: "Израиль отвергает юрисдикцию МУС и отрицает все обвинения. Израиль не является участником Римского статута.",
      countryDataRef: "Недоедание: 2.5%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-04 — Yoav Gallant
     ═══════════════════════════════════════════════════════════════ */
  "ICC-04": {
    en: {
      subject: "Yoav Gallant — Former Minister of Defense of Israel [ISR]",
      accusation: "ICC arrest warrant (ICC-01/18, issued 21 November 2024) for crimes against humanity and war crimes, including the war crime of starvation as a method of warfare, murder, persecution, and other inhumane acts committed in the Gaza Strip from at least 8 October 2023.",
      evidence: [
        "ICC Pre-Trial Chamber I arrest warrant (21 November 2024), case ICC-01/18",
        "Public statements by Gallant ordering 'complete siege' on Gaza (October 2023) — 'no electricity, no food, no fuel'",
        "UN Special Rapporteur report on the right to food documenting engineered famine conditions (2024)",
      ],
      rightOfResponse: "Gallant's legal team filed a jurisdictional challenge with the ICC (denied November 2024). Denies all charges.",
      countryDataRef: "Undernourishment: 2.5%",
    },
    pt: {
      subject: "Yoav Gallant — Ex-Ministro da Defesa de Israel [ISR]",
      accusation: "Mandado de prisão do TPI (ICC-01/18, emitido em 21 de novembro de 2024) por crimes contra a humanidade e crimes de guerra, incluindo o crime de guerra de fome como método de guerra, assassinato, perseguição e outros atos desumanos cometidos na Faixa de Gaza desde pelo menos 8 de outubro de 2023.",
      evidence: [
        "Mandado de prisão da Câmara de Instrução I do TPI (21 de novembro de 2024), caso ICC-01/18",
        "Declarações públicas de Gallant ordenando 'cerco completo' a Gaza (outubro de 2023) — 'sem eletricidade, sem comida, sem combustível'",
        "Relatório do Relator Especial da ONU sobre o direito à alimentação documentando condições de fome planejadas (2024)",
      ],
      rightOfResponse: "A equipa jurídica de Gallant apresentou contestação de jurisdição ao TPI (negada em novembro de 2024). Nega todas as acusações.",
      countryDataRef: "Subnutrição: 2.5%",
    },
    es: {
      subject: "Yoav Gallant — Exministro de Defensa de Israel [ISR]",
      accusation: "Orden de arresto de la CPI (ICC-01/18, emitida el 21 de noviembre de 2024) por crímenes de lesa humanidad y crímenes de guerra, incluyendo el crimen de guerra de inanición como método de guerra, asesinato, persecución y otros actos inhumanos cometidos en la Franja de Gaza desde al menos el 8 de octubre de 2023.",
      evidence: [
        "Orden de arresto de la Sala de Cuestiones Preliminares I de la CPI (21 de noviembre de 2024), caso ICC-01/18",
        "Declaraciones públicas de Gallant ordenando un 'asedio completo' a Gaza (octubre de 2023) — 'sin electricidad, sin comida, sin combustible'",
        "Informe del Relator Especial de la ONU sobre el derecho a la alimentación documentando condiciones de hambruna planificadas (2024)",
      ],
      rightOfResponse: "El equipo legal de Gallant presentó una impugnación de jurisdicción ante la CPI (denegada en noviembre de 2024). Niega todos los cargos.",
      countryDataRef: "Desnutrición: 2.5%",
    },
    fr: {
      subject: "Yoav Gallant — Ancien ministre de la Défense d'Israël [ISR]",
      accusation: "Mandat d'arrêt de la CPI (ICC-01/18, délivré le 21 novembre 2024) pour crimes contre l'humanité et crimes de guerre, y compris le crime de guerre de famine comme méthode de guerre, meurtre, persécution et autres actes inhumains commis dans la bande de Gaza depuis au moins le 8 octobre 2023.",
      evidence: [
        "Mandat d'arrêt de la Chambre préliminaire I de la CPI (21 novembre 2024), affaire ICC-01/18",
        "Déclarations publiques de Gallant ordonnant un 'siège complet' sur Gaza (octobre 2023) — 'pas d'électricité, pas de nourriture, pas de carburant'",
        "Rapport du Rapporteur spécial de l'ONU sur le droit à l'alimentation documentant des conditions de famine planifiées (2024)",
      ],
      rightOfResponse: "L'équipe juridique de Gallant a déposé un recours juridictionnel auprès de la CPI (rejeté en novembre 2024). Nie toutes les accusations.",
      countryDataRef: "Sous-alimentation: 2.5%",
    },
    zh: {
      subject: "Yoav Gallant — 以色列前国防部长 [ISR]",
      accusation: "国际刑事法院逮捕令（ICC-01/18，2024年11月21日签发），指控反人类罪和战争罪，包括将饥饿作为战争方法的战争罪、谋杀、迫害和其他不人道行为，自2023年10月8日起在加沙地带实施。",
      evidence: [
        "国际刑事法院预审一庭逮捕令（2024年11月21日），案件号ICC-01/18",
        "Gallant下令对加沙实施\u201c全面围困\u201d的公开声明（2023年10月）——\u201c没有电，没有食物，没有燃料\u201d",
        "联合国食物权问题特别报告员报告，记录蓄意制造的饥荒条件（2024年）",
      ],
      rightOfResponse: "Gallant的法律团队向国际刑事法院提出了管辖权异议（2024年11月被驳回）。否认所有指控。",
      countryDataRef: "营养不良率: 2.5%",
    },
    ja: {
      subject: "Yoav Gallant — イスラエル元国防大臣 [ISR]",
      accusation: "ICC逮捕状（ICC-01/18、2024年11月21日発行）により、人道に対する犯罪および戦争犯罪で起訴。戦争の手段としての飢餓の戦争犯罪、殺人、迫害、その他の非人道的行為を含み、2023年10月8日以降ガザ地区で犯された。",
      evidence: [
        "ICC予備審問法廷Iの逮捕状（2024年11月21日）、事件ICC-01/18",
        "Gallantによるガザへの「完全包囲」を命じる公開声明（2023年10月）——「電気なし、食糧なし、燃料なし」",
        "食料の権利に関する国連特別報告者の報告書、計画的飢饉状態を記録（2024年）",
      ],
      rightOfResponse: "Gallantの法務チームはICCに管轄権異議を申し立て（2024年11月却下）。すべての容疑を否定。",
      countryDataRef: "栄養不良率: 2.5%",
    },
    ko: {
      subject: "Yoav Gallant — 이스라엘 전 국방장관 [ISR]",
      accusation: "ICC 체포영장(ICC-01/18, 2024년 11월 21일 발부)으로 반인도적 범죄 및 전쟁 범죄 혐의. 전쟁 수단으로서의 기아라는 전쟁 범죄, 살인, 박해 및 기타 비인도적 행위를 포함하며, 2023년 10월 8일 이후 가자지구에서 자행됨.",
      evidence: [
        "ICC 예심재판부 I 체포영장(2024년 11월 21일), 사건 ICC-01/18",
        "Gallant의 가자에 대한 '완전한 포위' 명령 공개 성명(2023년 10월) — '전기도 없고, 식량도 없고, 연료도 없다'",
        "식량에 대한 권리에 관한 유엔 특별보고관 보고서, 의도적으로 조성된 기근 상황 기록(2024년)",
      ],
      rightOfResponse: "Gallant의 법률팀이 ICC에 관할권 이의를 제기(2024년 11월 기각). 모든 혐의를 부인함.",
      countryDataRef: "영양부족률: 2.5%",
    },
    hi: {
      subject: "Yoav Gallant — इज़राइल के पूर्व रक्षा मंत्री [ISR]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-01/18, 21 नवंबर 2024 को जारी) मानवता के खिलाफ अपराध और युद्ध अपराधों के लिए, जिनमें युद्ध की विधि के रूप में भुखमरी का युद्ध अपराध, हत्या, उत्पीड़न और अन्य अमानवीय कृत्य शामिल हैं, जो कम से कम 8 अक्टूबर 2023 से गाजा पट्टी में किए गए।",
      evidence: [
        "ICC प्राथमिकी चैम्बर I गिरफ्तारी वारंट (21 नवंबर 2024), मामला ICC-01/18",
        "Gallant के गाजा पर 'पूर्ण घेराबंदी' का आदेश देने वाले सार्वजनिक बयान (अक्टूबर 2023) — 'न बिजली, न भोजन, न ईंधन'",
        "भोजन के अधिकार पर संयुक्त राष्ट्र विशेष रिपोर्टर की रिपोर्ट, इंजीनियर की गई अकाल स्थिति का दस्तावेजीकरण (2024)",
      ],
      rightOfResponse: "Gallant की कानूनी टीम ने ICC में क्षेत्राधिकार चुनौती दाखिल की (नवंबर 2024 में अस्वीकृत)। सभी आरोपों से इनकार।",
      countryDataRef: "कुपोषण: 2.5%",
    },
    ar: {
      subject: "Yoav Gallant — وزير الدفاع الإسرائيلي السابق [ISR]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-01/18، صادرة في 21 نوفمبر 2024) بتهمة جرائم ضد الإنسانية وجرائم حرب، بما في ذلك جريمة حرب التجويع كأسلوب حربي، والقتل والاضطهاد والأفعال اللاإنسانية الأخرى المرتكبة في قطاع غزة منذ 8 أكتوبر 2023 على الأقل.",
      evidence: [
        "مذكرة توقيف من الدائرة التمهيدية الأولى للمحكمة الجنائية الدولية (21 نوفمبر 2024)، القضية ICC-01/18",
        "تصريحات عامة لـ Gallant تأمر بـ 'حصار كامل' على غزة (أكتوبر 2023) — 'لا كهرباء، لا طعام، لا وقود'",
        "تقرير المقرر الخاص للأمم المتحدة المعني بالحق في الغذاء يوثق ظروف المجاعة المفتعلة (2024)",
      ],
      rightOfResponse: "قدم الفريق القانوني لـ Gallant طعناً قضائياً للمحكمة الجنائية الدولية (رفض في نوفمبر 2024). ينفي جميع التهم.",
      countryDataRef: "سوء التغذية: 2.5%",
    },
    ru: {
      subject: "Yoav Gallant — Бывший министр обороны Израиля [ISR]",
      accusation: "Ордер на арест МУС (ICC-01/18, выдан 21 ноября 2024 г.) за преступления против человечности и военные преступления, включая военное преступление в виде использования голода как метода ведения войны, убийство, преследование и другие бесчеловечные акты, совершённые в секторе Газа по меньшей мере с 8 октября 2023 г.",
      evidence: [
        "Ордер на арест Суда предварительного разбирательства I МУС (21 ноября 2024 г.), дело ICC-01/18",
        "Публичные заявления Gallant о приказе «полной блокады» Газы (октябрь 2023 г.) — «ни электричества, ни еды, ни топлива»",
        "Доклад Специального докладчика ООН по праву на питание, зафиксировавший искусственно созданные условия голода (2024 г.)",
      ],
      rightOfResponse: "Юридическая команда Gallant подала юрисдикционную жалобу в МУС (отклонена в ноябре 2024 г.). Отрицает все обвинения.",
      countryDataRef: "Недоедание: 2.5%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-05 — Omar al-Bashir
     ═══════════════════════════════════════════════════════════════ */
  "ICC-05": {
    en: {
      subject: "Omar al-Bashir — Former President of Sudan [SDN]",
      accusation: "ICC arrest warrant (ICC-02/05-01/09, first issued 4 March 2009, amended 12 July 2010) for five counts of crimes against humanity (murder, extermination, forcible transfer, torture, rape) and two counts of war crimes (pillaging, intentionally directing attacks) committed in Darfur. A separate warrant added three counts of genocide in 2010.",
      evidence: [
        "ICC arrest warrant (4 March 2009), case ICC-02/05-01/09 — first sitting head of state indicted by the ICC",
        "UN Security Council Resolution 1593 (2005) referring Darfur to the ICC — legally binding under Chapter VII",
        "UN Commission of Inquiry on Darfur report documenting 300,000+ deaths and systematic mass atrocities (January 2005)",
      ],
      rightOfResponse: "Al-Bashir and the Sudanese government (at the time) rejected ICC jurisdiction. He was ousted in April 2019 and is detained in Sudan. The ICC transfer request remains pending.",
      countryDataRef: "Conflict intensity: 5/5 · Displacement: 10.0M · Famine risk: 5/5",
    },
    pt: {
      subject: "Omar al-Bashir — Ex-Presidente do Sudão [SDN]",
      accusation: "Mandado de prisão do TPI (ICC-02/05-01/09, emitido em 4 de março de 2009, alterado em 12 de julho de 2010) por cinco acusações de crimes contra a humanidade (assassinato, extermínio, transferência forçada, tortura, estupro) e duas acusações de crimes de guerra (pilhagem, direcionar intencionalmente ataques) cometidos em Darfur. Um mandado separado adicionou três acusações de genocídio em 2010.",
      evidence: [
        "Mandado de prisão do TPI (4 de março de 2009), caso ICC-02/05-01/09 — primeiro chefe de estado em exercício indiciado pelo TPI",
        "Resolução 1593 (2005) do Conselho de Segurança da ONU encaminhando Darfur ao TPI — juridicamente vinculativa nos termos do Capítulo VII",
        "Relatório da Comissão de Inquérito da ONU sobre Darfur documentando mais de 300.000 mortes e atrocidades em massa sistemáticas (janeiro de 2005)",
      ],
      rightOfResponse: "Al-Bashir e o governo sudanês (na época) rejeitaram a jurisdição do TPI. Ele foi deposto em abril de 2019 e está detido no Sudão. O pedido de transferência do TPI permanece pendente.",
      countryDataRef: "Intensidade do conflito: 5/5 · Deslocamento: 10.0M · Risco de fome: 5/5",
    },
    es: {
      subject: "Omar al-Bashir — Expresidente de Sudán [SDN]",
      accusation: "Orden de arresto de la CPI (ICC-02/05-01/09, emitida el 4 de marzo de 2009, modificada el 12 de julio de 2010) por cinco cargos de crímenes de lesa humanidad (asesinato, exterminio, traslado forzoso, tortura, violación) y dos cargos de crímenes de guerra (saqueo, dirigir intencionalmente ataques) cometidos en Darfur. Una orden separada añadió tres cargos de genocidio en 2010.",
      evidence: [
        "Orden de arresto de la CPI (4 de marzo de 2009), caso ICC-02/05-01/09 — primer jefe de Estado en ejercicio procesado por la CPI",
        "Resolución 1593 (2005) del Consejo de Seguridad de la ONU que remite Darfur a la CPI — vinculante legalmente bajo el Capítulo VII",
        "Informe de la Comisión de Investigación de la ONU sobre Darfur documentando más de 300.000 muertes y atrocidades masivas sistemáticas (enero de 2005)",
      ],
      rightOfResponse: "Al-Bashir y el gobierno sudanés (en ese momento) rechazaron la jurisdicción de la CPI. Fue derrocado en abril de 2019 y está detenido en Sudán. La solicitud de transferencia de la CPI sigue pendiente.",
      countryDataRef: "Intensidad del conflicto: 5/5 · Desplazamiento: 10.0M · Riesgo de hambruna: 5/5",
    },
    fr: {
      subject: "Omar al-Bashir — Ancien président du Soudan [SDN]",
      accusation: "Mandat d'arrêt de la CPI (ICC-02/05-01/09, délivré le 4 mars 2009, modifié le 12 juillet 2010) pour cinq chefs de crimes contre l'humanité (meurtre, extermination, transfert forcé, torture, viol) et deux chefs de crimes de guerre (pillage, direction intentionnelle d'attaques) commis au Darfour. Un mandat distinct a ajouté trois chefs de génocide en 2010.",
      evidence: [
        "Mandat d'arrêt de la CPI (4 mars 2009), affaire ICC-02/05-01/09 — premier chef d'État en exercice inculpé par la CPI",
        "Résolution 1593 (2005) du Conseil de sécurité de l'ONU renvoyant le Darfour à la CPI — juridiquement contraignante au titre du Chapitre VII",
        "Rapport de la Commission d'enquête de l'ONU sur le Darfour documentant plus de 300 000 morts et des atrocités de masse systématiques (janvier 2005)",
      ],
      rightOfResponse: "Al-Bashir et le gouvernement soudanais (à l'époque) ont rejeté la juridiction de la CPI. Il a été renversé en avril 2019 et est détenu au Soudan. La demande de transfert de la CPI reste en attente.",
      countryDataRef: "Intensité du conflit: 5/5 · Déplacement: 10.0M · Risque de famine: 5/5",
    },
    zh: {
      subject: "Omar al-Bashir — 苏丹前总统 [SDN]",
      accusation: "国际刑事法院逮捕令（ICC-02/05-01/09，2009年3月4日首次签发，2010年7月12日修订），指控在达尔富尔犯下的五项反人类罪（谋杀、灭绝、强行转移、酷刑、强奸）和两项战争罪（掠夺、故意指挥攻击）。2010年另一份逮捕令增加了三项种族灭绝罪。",
      evidence: [
        "国际刑事法院逮捕令（2009年3月4日），案件号ICC-02/05-01/09——首个被国际刑事法院起诉的在任国家元首",
        "联合国安理会第1593号决议（2005年），将达尔富尔移交国际刑事法院——根据第七章具有法律约束力",
        "联合国达尔富尔调查委员会报告，记录超过30万死亡和系统性大规模暴行（2005年1月）",
      ],
      rightOfResponse: "Al-Bashir和苏丹政府（当时）拒绝了国际刑事法院的管辖权。他于2019年4月被推翻并被关押在苏丹。国际刑事法院的移交请求仍未解决。",
      countryDataRef: "冲突强度: 5/5 · 流离失所: 10.0M · 饥荒风险: 5/5",
    },
    ja: {
      subject: "Omar al-Bashir — スーダン元大統領 [SDN]",
      accusation: "ICC逮捕状（ICC-02/05-01/09、2009年3月4日初発行、2010年7月12日修正）により、ダルフールで犯された人道に対する犯罪5件（殺人、絶滅、強制移住、拷問、強姦）および戦争犯罪2件（略奪、意図的な攻撃指揮）で起訴。2010年に別の逮捕状でジェノサイド3件が追加された。",
      evidence: [
        "ICC逮捕状（2009年3月4日）、事件ICC-02/05-01/09——ICCにより起訴された初の在職中の国家元首",
        "国連安全保障理事会決議1593（2005年）によるダルフールのICC付託——第7章に基づき法的拘束力あり",
        "ダルフールに関する国連調査委員会報告書、30万人以上の死亡と組織的な大量虐殺を記録（2005年1月）",
      ],
      rightOfResponse: "Al-Bashirおよびスーダン政府（当時）はICCの管轄権を拒否。2019年4月に失脚し、スーダンで拘束中。ICCの身柄引渡請求は保留中。",
      countryDataRef: "紛争の激しさ: 5/5 · 避難者数: 10.0M · 飢饉リスク: 5/5",
    },
    ko: {
      subject: "Omar al-Bashir — 수단 전 대통령 [SDN]",
      accusation: "ICC 체포영장(ICC-02/05-01/09, 2009년 3월 4일 최초 발부, 2010년 7월 12일 수정)으로 다르푸르에서 자행된 반인도적 범죄 5건(살인, 절멸, 강제 이주, 고문, 강간) 및 전쟁 범죄 2건(약탈, 의도적 공격 지시) 혐의. 2010년 별도 영장으로 집단학살 3건 추가.",
      evidence: [
        "ICC 체포영장(2009년 3월 4일), 사건 ICC-02/05-01/09 — ICC에 기소된 최초의 재직 중 국가원수",
        "유엔 안전보장이사회 결의 1593(2005년), 다르푸르를 ICC에 회부 — 제7장에 따라 법적 구속력 있음",
        "다르푸르 관련 유엔 조사위원회 보고서, 30만 명 이상의 사망과 체계적 대량 학살 기록(2005년 1월)",
      ],
      rightOfResponse: "Al-Bashir와 수단 정부(당시)는 ICC 관할권을 거부함. 2019년 4월 축출되어 수단에 구금 중. ICC 인도 청구는 계류 중.",
      countryDataRef: "갈등 강도: 5/5 · 실향민: 10.0M · 기근 위험: 5/5",
    },
    hi: {
      subject: "Omar al-Bashir — सूडान के पूर्व राष्ट्रपति [SDN]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-02/05-01/09, पहली बार 4 मार्च 2009 को जारी, 12 जुलाई 2010 को संशोधित) दारफुर में किए गए मानवता के खिलाफ अपराधों के पांच मामलों (हत्या, विनाश, जबरन स्थानांतरण, यातना, बलात्कार) और युद्ध अपराधों के दो मामलों (लूटपाट, जानबूझकर हमलों का निर्देशन) के लिए। 2010 में एक अलग वारंट में नरसंहार के तीन मामले जोड़े गए।",
      evidence: [
        "ICC गिरफ्तारी वारंट (4 मार्च 2009), मामला ICC-02/05-01/09 — ICC द्वारा अभियुक्त पहले पदस्थ राष्ट्रप्रमुख",
        "संयुक्त राष्ट्र सुरक्षा परिषद प्रस्ताव 1593 (2005) दारफुर को ICC के पास भेजते हुए — अध्याय VII के तहत कानूनी रूप से बाध्यकारी",
        "दारफुर पर संयुक्त राष्ट्र जांच आयोग की रिपोर्ट, 300,000+ मौतों और व्यवस्थित बड़े पैमाने पर अत्याचारों का दस्तावेजीकरण (जनवरी 2005)",
      ],
      rightOfResponse: "Al-Bashir और सूडानी सरकार (तब) ने ICC क्षेत्राधिकार अस्वीकार किया। उन्हें अप्रैल 2019 में हटाया गया और सूडान में निरुद्ध हैं। ICC स्थानांतरण अनुरोध लंबित है।",
      countryDataRef: "संघर्ष की तीव्रता: 5/5 · विस्थापन: 10.0M · अकाल जोखिम: 5/5",
    },
    ar: {
      subject: "Omar al-Bashir — الرئيس السابق للسودان [SDN]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-02/05-01/09، صادرة لأول مرة في 4 مارس 2009، معدّلة في 12 يوليو 2010) بخمسة تهم جرائم ضد الإنسانية (القتل، الإبادة، النقل القسري، التعذيب، الاغتصاب) وتهمتي جرائم حرب (النهب، توجيه الهجمات عمداً) المرتكبة في دارفور. أضافت مذكرة منفصلة ثلاث تهم بالإبادة الجماعية في 2010.",
      evidence: [
        "مذكرة توقيف من المحكمة الجنائية الدولية (4 مارس 2009)، القضية ICC-02/05-01/09 — أول رئيس دولة في المنصب يُوجه إليه الاتهام من قبل المحكمة",
        "قرار مجلس الأمن التابع للأمم المتحدة رقم 1593 (2005) بإحالة دارفور إلى المحكمة الجنائية الدولية — ملزم قانونياً بموجب الفصل السابع",
        "تقرير لجنة التحقيق التابعة للأمم المتحدة في دارفور يوثق أكثر من 300,000 وفاة وفظائع جماعية منهجية (يناير 2005)",
      ],
      rightOfResponse: "رفض al-Bashir والحكومة السودانية (في ذلك الوقت) ولاية المحكمة الجنائية الدولية. تمت الإطاحة به في أبريل 2019 وهو محتجز في السودان. يظل طلب نقل المحكمة الجنائية الدولية معلقاً.",
      countryDataRef: "شدة الصراع: 5/5 · النزوح: 10.0M · خطر المجاعة: 5/5",
    },
    ru: {
      subject: "Omar al-Bashir — Бывший президент Судана [SDN]",
      accusation: "Ордер на арест МУС (ICC-02/05-01/09, впервые выдан 4 марта 2009 г., изменён 12 июля 2010 г.) по пяти пунктам обвинения в преступлениях против человечности (убийство, истребление, насильственное переселение, пытки, изнасилование) и двум пунктам обвинения в военных преступлениях (мародёрство, умышленное руководство нападениями), совершённых в Дарфуре. Отдельный ордер добавил три пункта обвинения в геноциде в 2010 году.",
      evidence: [
        "Ордер на арест МУС (4 марта 2009 г.), дело ICC-02/05-01/09 — первый действующий глава государства, обвинённый МУС",
        "Резолюция 1593 (2005) Совета Безопасности ООН о передаче Дарфура в МУС — имеет обязательную юридическую силу согласно Главе VII",
        "Доклад Комиссии ООН по расследованию в Дарфуре, зафиксировавший более 300 000 смертей и систематические массовые злодеяния (январь 2005 г.)",
      ],
      rightOfResponse: "Al-Bashir и суданское правительство (в то время) отвергли юрисдикцию МУС. Он был свергнут в апреле 2019 года и содержится под стражей в Судане. Запрос МУС о передаче остаётся нерассмотренным.",
      countryDataRef: "Интенсивность конфликта: 5/5 · Перемещение: 10.0M · Риск голода: 5/5",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICC-06 — Hibatullah Akhundzada
     ═══════════════════════════════════════════════════════════════ */
  "ICC-06": {
    en: {
      subject: "Hibatullah Akhundzada — Supreme Leader of the Taliban [AFG]",
      accusation: "ICC arrest warrant (ICC-02/57, issued 8 July 2025) for crimes against humanity, specifically gender-based persecution of women and girls in Afghanistan since August 2021. The warrant covers the systematic deprivation of liberty, education, employment, and freedom of movement based on gender.",
      evidence: [
        "ICC Pre-Trial Chamber II arrest warrant (8 July 2025), case ICC-02/57",
        "UN Special Rapporteur on Afghanistan report documenting gender apartheid (2023-2025)",
        "Amnesty International and IRC joint report 'The Taliban's War on Women' (2023)",
      ],
      rightOfResponse: "The Taliban has not formally responded. A Taliban spokesperson rejected the ICC's jurisdiction.",
      countryDataRef: "Conflict intensity: 3/5 · Displacement: 6.0M · Famine risk: 3/5 · Undernourishment: 28.9%",
    },
    pt: {
      subject: "Hibatullah Akhundzada — Líder Supremo do Talibã [AFG]",
      accusation: "Mandado de prisão do TPI (ICC-02/57, emitido em 8 de julho de 2025) por crimes contra a humanidade, especificamente perseguição baseada em gênero contra mulheres e meninas no Afeganistão desde agosto de 2021. O mandado abrange a privação sistemática de liberdade, educação, emprego e liberdade de movimento com base em gênero.",
      evidence: [
        "Mandado de prisão da Câmara de Instrução II do TPI (8 de julho de 2025), caso ICC-02/57",
        "Relatório do Relator Especial da ONU sobre o Afeganistão documentando o apartheid de género (2023-2025)",
        "Relatório conjunto da Anistia Internacional e do IRC 'A Guerra do Talibã contra as Mulheres' (2023)",
      ],
      rightOfResponse: "O Talibã não respondeu formalmente. Um porta-voz do Talibã rejeitou a jurisdição do TPI.",
      countryDataRef: "Intensidade do conflito: 3/5 · Deslocamento: 6.0M · Risco de fome: 3/5 · Subnutrição: 28.9%",
    },
    es: {
      subject: "Hibatullah Akhundzada — Líder Supremo de los Talibanes [AFG]",
      accusation: "Orden de arresto de la CPI (ICC-02/57, emitida el 8 de julio de 2025) por crímenes contra la humanidad, específicamente persecución por motivos de género contra mujeres y niñas en Afganistán desde agosto de 2021. La orden cubre la privación sistemática de libertad, educación, empleo y libertad de movimiento por motivos de género.",
      evidence: [
        "Orden de arresto de la Sala de Cuestiones Preliminares II de la CPI (8 de julio de 2025), caso ICC-02/57",
        "Informe del Relator Especial de la ONU sobre Afganistán documentando el apartheid de género (2023-2025)",
        "Informe conjunto de Amnistía Internacional y el IRC 'La Guerra de los Talibanes contra las Mujeres' (2023)",
      ],
      rightOfResponse: "Los Talibanes no han respondido formalmente. Un portavoz talibán rechazó la jurisdicción de la CPI.",
      countryDataRef: "Intensidad del conflicto: 3/5 · Desplazamiento: 6.0M · Riesgo de hambruna: 3/5 · Desnutrición: 28.9%",
    },
    fr: {
      subject: "Hibatullah Akhundzada — Chef suprême des Talibans [AFG]",
      accusation: "Mandat d'arrêt de la CPI (ICC-02/57, délivré le 8 juillet 2025) pour crimes contre l'humanité, spécifiquement la persécution fondée sur le genre contre les femmes et les filles en Afghanistan depuis août 2021. Le mandat couvre la privation systématique de liberté, d'éducation, d'emploi et de liberté de mouvement fondée sur le genre.",
      evidence: [
        "Mandat d'arrêt de la Chambre préliminaire II de la CPI (8 juillet 2025), affaire ICC-02/57",
        "Rapport du Rapporteur spécial de l'ONU sur l'Afghanistan documentant l'apartheid de genre (2023-2025)",
        "Rapport conjoint d'Amnesty International et de l'IRC 'La guerre des Talibans contre les femmes' (2023)",
      ],
      rightOfResponse: "Les Talibans n'ont pas répondu formellement. Un porte-parole taliban a rejeté la juridiction de la CPI.",
      countryDataRef: "Intensité du conflit: 3/5 · Déplacement: 6.0M · Risque de famine: 3/5 · Sous-alimentation: 28.9%",
    },
    zh: {
      subject: "Hibatullah Akhundzada — 塔利班最高领袖 [AFG]",
      accusation: "国际刑事法院逮捕令（ICC-02/57，2025年7月8日签发），指控自2021年8月以来在阿富汗对妇女和女童进行基于性别的迫害的反人类罪。该逮捕令涵盖基于性别系统性地剥夺自由、教育、就业和行动自由。",
      evidence: [
        "国际刑事法院预审二庭逮捕令（2025年7月8日），案件号ICC-02/57",
        "联合国阿富汗问题特别报告员报告，记录性别隔离（2023-2025）",
        "国际特赦组织与国际救援委员会联合报告《塔利班对妇女的战争》（2023）",
      ],
      rightOfResponse: "塔利班未作正式回应。一名塔利班发言人拒绝国际刑事法院的管辖权。",
      countryDataRef: "冲突强度: 3/5 · 流离失所: 6.0M · 饥荒风险: 3/5 · 营养不良率: 28.9%",
    },
    ja: {
      subject: "Hibatullah Akhundzada — タリバンの最高指導者 [AFG]",
      accusation: "ICC逮捕状（ICC-02/57、2025年7月8日発行）により、2021年8月以降アフガニスタンにおける女性および少女に対するジェンダーに基づく迫害という人道に対する犯罪で起訴。逮捕状はジェンダーに基づく自由、教育、雇用、移動の自由の組織的剥奪を含む。",
      evidence: [
        "ICC予備審問法廷IIの逮捕状（2025年7月8日）、事件ICC-02/57",
        "アフガニスタンに関する国連特別報告者の報告書、ジェンダー・アパルトヘイトを記録（2023-2025年）",
        "アムネスティ・インターナショナルとIRCの合同報告書『女性に対するタリバンの戦争』（2023年）",
      ],
      rightOfResponse: "タリバンは正式に回答していない。タリバンの報道官はICCの管轄権を拒否した。",
      countryDataRef: "紛争の激しさ: 3/5 · 避難者数: 6.0M · 飢饉リスク: 3/5 · 栄養不良率: 28.9%",
    },
    ko: {
      subject: "Hibatullah Akhundzada — 탈레반 최고 지도자 [AFG]",
      accusation: "ICC 체포영장(ICC-02/57, 2025년 7월 8일 발부)으로 2021년 8월 이후 아프가니스탄에서 여성과 소녀에 대한 젠더 기반 박해라는 반인도적 범죄 혐의. 영장은 젠더에 기반한 자유, 교육, 고용, 이동의 자유의 체계적 박탈을 포괄함.",
      evidence: [
        "ICC 예심재판부 II 체포영장(2025년 7월 8일), 사건 ICC-02/57",
        "아프가니스탄 관련 유엔 특별보고관 보고서, 젠더 아파르트헤이트 기록(2023-2025년)",
        "국제사면위원회와 IRC 공동 보고서 '여성에 대한 탈레반의 전쟁'(2023년)",
      ],
      rightOfResponse: "탈레반은 공식적으로 답변하지 않음. 탈레반 대변인은 ICC 관할권을 거부함.",
      countryDataRef: "갈등 강도: 3/5 · 실향민: 6.0M · 기근 위험: 3/5 · 영양부족률: 28.9%",
    },
    hi: {
      subject: "Hibatullah Akhundzada — तालिबान के सर्वोच्च नेता [AFG]",
      accusation: "ICC गिरफ्तारी वारंट (ICC-02/57, 8 जुलाई 2025 को जारी) मानवता के खिलाफ अपराधों के लिए, विशेष रूप से अगस्त 2021 से अफगानिस्तान में महिलाओं और लड़कियों के खिलाफ लिंग-आधारित उत्पीड़न। वारंट में लिंग के आधार पर स्वतंत्रता, शिक्षा, रोजगार और आवाजना की स्वतंत्रता का व्यवस्थित वंचन शामिल है।",
      evidence: [
        "ICC प्राथमिकी चैम्बर II गिरफ्तारी वारंट (8 जुलाई 2025), मामला ICC-02/57",
        "अफगानिस्तान पर संयुक्त राष्ट्र विशेष रिपोर्टर की रिपोर्ट, लिंग अपार्थाइट का दस्तावेजीकरण (2023-2025)",
        "एमनेस्टी इंटरनेशनल और IRC की संयुक्त रिपोर्ट 'महिलाओं के खिलाफ तालिबान का युद्ध' (2023)",
      ],
      rightOfResponse: "तालिबान ने औपचारिक रूप से जवाब नहीं दिया है। एक तालिबान प्रवक्ता ने ICC के क्षेत्राधिकार को अस्वीकार कर दिया।",
      countryDataRef: "संघर्ष की तीव्रता: 3/5 · विस्थापन: 6.0M · अकाल जोखिम: 3/5 · कुपोषण: 28.9%",
    },
    ar: {
      subject: "Hibatullah Akhundzada — القائد الأعلى لحركة طالبان [AFG]",
      accusation: "مذكرة توقيف من المحكمة الجنائية الدولية (ICC-02/57، صادرة في 8 يوليو 2025) بتهمة جرائم ضد الإنسانية، وتحديداً الاضطهاد القائم على النوع الاجتماعي ضد النساء والفتيات في أفغانستان منذ أغسطس 2021. تغطي المذكرة الحرمان المنهجي من الحرية والتعليم والتوظيف وحرية التنقل على أساس النوع الاجتماعي.",
      evidence: [
        "مذكرة توقيف من الدائرة التمهيدية الثانية للمحكمة الجنائية الدولية (8 يوليو 2025)، القضية ICC-02/57",
        "تقرير المقرر الخاص للأمم المتحدة المعني بأفغانستان يوثق الفصل العنصري القائم على النوع الاجتماعي (2023-2025)",
        "تقرير مشترك لمنظمة العفو الدولية واللجنة الدولية للإنقاذ 'حرب طالبان على النساء' (2023)",
      ],
      rightOfResponse: "لم ترد حركة طالبان رسمياً. ورفض متحدث باسم طالبان ولاية المحكمة الجنائية الدولية.",
      countryDataRef: "شدة الصراع: 3/5 · النزوح: 6.0M · خطر المجاعة: 3/5 · سوء التغذية: 28.9%",
    },
    ru: {
      subject: "Hibatullah Akhundzada — Верховный лидер талибов [AFG]",
      accusation: "Ордер на арест МУС (ICC-02/57, выдан 8 июля 2025 г.) за преступления против человечности, а именно за преследование по признаку пола в отношении женщин и девочек в Афганистане с августа 2021 года. Ордер охватывает систематическое лишение свободы, образования, трудоустройства и свободы передвижения по признаку пола.",
      evidence: [
        "Ордер на арест Суда предварительного разбирательства II МУС (8 июля 2025 г.), дело ICC-02/57",
        "Доклад Специального докладчика ООН по Афганистану, зафиксировавший гендерный апартеид (2023-2025 гг.)",
        "Совместный доклад Amnesty International и IRC «Война талибов против женщин» (2023 г.)",
      ],
      rightOfResponse: "Талибы официально не ответили. Представитель талибов отверг юрисдикцию МУС.",
      countryDataRef: "Интенсивность конфликта: 3/5 · Перемещение: 6.0M · Риск голода: 3/5 · Недоедание: 28.9%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     ICJ-01 — State of Israel, South Africa v. Israel
     ═══════════════════════════════════════════════════════════════ */
  "ICJ-01": {
    en: {
      subject: "State of Israel — Respondent, South Africa v. Israel [ISR]",
      accusation: "ICJ proceedings (Application of the Convention on the Prevention and Punishment of the Crime of Genocide in the Gaza Strip, South Africa v. Israel). South Africa alleges Israel has committed and is committing genocide against Palestinians in Gaza, violating the Genocide Convention. The ICJ has issued three sets of provisional measures ordering Israel to prevent genocidal acts (26 January 2024, 28 March 2024, 24 May 2024).",
      evidence: [
        "ICJ Order on Provisional Measures (26 January 2024) — found plausible risk of genocide and ordered Israel to take all measures to prevent genocidal acts",
        "ICJ Additional Provisional Measures (28 March 2024 and 24 May 2024) — found imminent risk of irreparable prejudice and ordered halt to military operations in Rafah",
        "UN Special Committee report finding Israel's warfare methods consistent with genocide characteristics (November 2024)",
        "OCHA casualty and humanitarian data: 40,000+ killed, 96% population displaced, engineered famine (2024)",
      ],
      rightOfResponse: "Israel rejects the genocide allegation as 'baseless' and has filed counter-arguments. Israel argues military operations target Hamas, not Palestinian civilians.",
      countryDataRef: "Undernourishment: 2.5%",
    },
    pt: {
      subject: "Estado de Israel — Réu, África do Sul v. Israel [ISR]",
      accusation: "Processos da CIJ (Aplicação da Convenção para a Prevenção e Repressão do Crime de Genocídio na Faixa de Gaza, África do Sul v. Israel). A África do Sul alega que Israel cometeu e está a cometer genocídio contra os palestinianos em Gaza, violando a Convenção sobre o Genocídio. A CIJ emitiu três conjuntos de medidas provisórias ordenando a Israel que previna atos genocidas (26 de janeiro de 2024, 28 de março de 2024, 24 de maio de 2024).",
      evidence: [
        "Ordem da CIJ sobre Medidas Provisórias (26 de janeiro de 2024) — constatou risco plausível de genocídio e ordenou a Israel que tomasse todas as medidas para prevenir atos genocidas",
        "Medidas Provisórias Adicionais da CIJ (28 de março de 2024 e 24 de maio de 2024) — constatou risco iminente de prejuízo irreparável e ordenou a paragem das operações militares em Rafah",
        "Relatório do Comité Especial da ONU concluindo que os métodos de guerra de Israel são consistentes com as características de genocídio (novembro de 2024)",
        "Dados de baixas e humanitários da OCHA: mais de 40.000 mortos, 96% da população deslocada, fome planejada (2024)",
      ],
      rightOfResponse: "Israel rejeita a alegação de genocídio como 'infundada' e apresentou contrargumentos. Israel argumenta que as operações militares visam o Hamas, não os civis palestinianos.",
      countryDataRef: "Subnutrição: 2.5%",
    },
    es: {
      subject: "Estado de Israel — Demandado, Sudáfrica v. Israel [ISR]",
      accusation: "Procedimientos de la CIJ (Aplicación de la Convención para la Prevención y la Sanción del Delito de Genocidio en la Franja de Gaza, Sudáfrica v. Israel). Sudáfrica alega que Israel ha cometido y está cometiendo genocidio contra los palestinos en Gaza, violando la Convención sobre el Genocidio. La CIJ ha emitido tres conjuntos de medidas provisionales ordenando a Israel prevenir actos genocidas (26 de enero de 2024, 28 de marzo de 2024, 24 de mayo de 2024).",
      evidence: [
        "Orden de la CIJ sobre Medidas Provisionales (26 de enero de 2024) — constató riesgo plausible de genocidio y ordenó a Israel tomar todas las medidas para prevenir actos genocidas",
        "Medidas Provisionales Adicionales de la CIJ (28 de marzo de 2024 y 24 de mayo de 2024) — constató riesgo inminente de perjuicio irreparable y ordenó detener las operaciones militares en Rafah",
        "Informe del Comité Especial de la ONU concluyendo que los métodos de guerra de Israel son consistentes con las características de genocidio (noviembre de 2024)",
        "Datos de bajas y humanitarios de OCHA: más de 40.000 muertos, 96% de la población desplazada, hambruna planificada (2024)",
      ],
      rightOfResponse: "Israel rechaza la acusación de genocidio como 'infundada' y ha presentado contrarréplicas. Israel argumenta que las operaciones militares se dirigen a Hamas, no a los civiles palestinos.",
      countryDataRef: "Desnutrición: 2.5%",
    },
    fr: {
      subject: "État d'Israël — Défendeur, Afrique du Sud c. Israël [ISR]",
      accusation: "Procédures de la CIJ (Application de la Convention pour la prévention et la répression du crime de génocide dans la bande de Gaza, Afrique du Sud c. Israël). L'Afrique du Sud allègue qu'Israël a commis et commet un génocide contre les Palestiniens à Gaza, violant la Convention sur le génocide. La CIJ a émis trois séries de mesures provisoires ordonnant à Israël de prévenir les actes génocidaires (26 janvier 2024, 28 mars 2024, 24 mai 2024).",
      evidence: [
        "Ordonnance de la CIJ sur les mesures provisoires (26 janvier 2024) — a constaté un risque plausible de génocide et a ordonné à Israël de prendre toutes les mesures pour prévenir les actes génocidaires",
        "Mesures provisoires additionnelles de la CIJ (28 mars 2024 et 24 mai 2024) — a constaté un risque imminent de préjudice irréparable et a ordonné l'arrêt des opérations militaires à Rafah",
        "Rapport du Comité spécial de l'ONU concluant que les méthodes de guerre d'Israël sont compatibles avec les caractéristiques du génocide (novembre 2024)",
        "Données sur les victimes et humanitaires d'OCHA: plus de 40 000 tués, 96% de la population déplacée, famine planifiée (2024)",
      ],
      rightOfResponse: "Israël rejette l'allégation de génocide comme 'infondée' et a déposé des contre-arguments. Israël soutient que les opérations militaires ciblent le Hamas, pas les civils palestiniens.",
      countryDataRef: "Sous-alimentation: 2.5%",
    },
    zh: {
      subject: "以色列国——被申请人，南非诉以色列案 [ISR]",
      accusation: "国际法院诉讼程序（《防止及惩治灭绝种族罪公约》在加沙地带的适用案，南非诉以色列）。南非指控以色列已经并正在对加沙的巴勒斯坦人实施种族灭绝，违反《灭绝种族罪公约》。国际法院已发布三套临时措施，命令以色列防止种族灭绝行为（2024年1月26日、2024年3月28日、2024年5月24日）。",
      evidence: [
        "国际法院临时措施命令（2024年1月26日）——认定存在合理的种族灭绝风险，命令以色列采取一切措施防止种族灭绝行为",
        "国际法院附加临时措施（2024年3月28日和2024年5月24日）——认定存在不可弥补损害的迫近风险，命令停止在拉法的军事行动",
        "联合国特别委员会报告，认定以色列的战争方法与种族灭绝特征一致（2024年11月）",
        "OCHA伤亡和人道主义数据：超过40,000人死亡，96%人口流离失所，蓄意制造饥荒（2024年）",
      ],
      rightOfResponse: "以色列以\u201c毫无根据\u201d为由拒绝种族灭绝指控，并已提交反驳论据。以色列辩称军事行动针对哈马斯，而非巴勒斯坦平民。",
      countryDataRef: "营养不良率: 2.5%",
    },
    ja: {
      subject: "イスラエル国 — 被告、南アフリカ v. イスラエル [ISR]",
      accusation: "ICJ訴訟（ガザ地区におけるジェノサイド条約の適用、南アフリカ v. イスラエル）。南アフリカはイスラエルがガザのパレスチナ人に対してジェノサイドを行い、かつ行っていると主張し、ジェノサイド条約違反を訴えている。ICJはイスラエルにジェノサイド行為を防止するよう命じる3度の暫定措置を発出した（2024年1月26日、2024年3月28日、2024年5月24日）。",
      evidence: [
        "ICJ暫定措置命令（2024年1月26日）——ジェノサイドの妥当なリスクを認定し、イスラエルにジェノサイド行為を防ぐためのあらゆる措置を取るよう命じた",
        "ICJ追加暫定措置（2024年3月28日および2024年5月24日）——修復不可能な損害の差し迫ったリスクを認定し、ラファでの軍事作戦の停止を命じた",
        "国連特別委員会報告書、イスラエルの戦争方法がジェノサイドの特徴と一致すると結論（2024年11月）",
        "OCHAの犠牲者および人道データ：40,000人以上死亡、人口の96%が避難、計画的飢饉（2024年）",
      ],
      rightOfResponse: "イスラエルはジェノサイドの主張を「根拠がない」として拒否し、反論を提出。イスラエルは軍事作戦の対象はハマスであり、パレスチナの民間人ではないと主張。",
      countryDataRef: "栄養不良率: 2.5%",
    },
    ko: {
      subject: "이스라엘 국가 — 피신청인, 남아프리카공화국 v. 이스라엘 [ISR]",
      accusation: "ICJ 소송절차(가자지구에서의 집단학살범죄 방지 및 처벌 협약의 적용, 남아프리카공화국 v. 이스라엘). 남아프리카공화국은 이스라엘이 가자의 팔레스타인인에 대해 집단학살을 자행했으며 자행하고 있다고 주장하며, 집단학살 협약 위반을 제소함. ICJ는 이스라엘에 집단학살 행위를 예방하라는 세 차례의 잠정 조치를 발령함(2024년 1월 26일, 2024년 3월 28일, 2024년 5월 24일).",
      evidence: [
        "ICJ 잠정 조치 명령(2024년 1월 26일) — 집단학살의 타당한 위험을 인정하고 이스라엘에 집단학살 행위를 예방하기 위한 모든 조치를 취하라고 명령",
        "ICJ 추가 잠정 조치(2024년 3월 28일 및 2024년 5월 24일) — 회복 불가능한 피해의 임박한 위험을 인정하고 라파에서의 군사 작전 중단을 명령",
        "유엔 특별위원회 보고서, 이스라엘의 전쟁 방식이 집단학살 특성과 일치한다고 결론(2024년 11월)",
        "OCHA 사상자 및 인도적 데이터: 40,000명 이상 사망, 인구의 96% 실향, 의도적 기근(2024년)",
      ],
      rightOfResponse: "이스라엘은 집단학살 혐의를 '근거 없는' 것으로 거부하고 반론을 제출함. 이스라엘은 군사 작업의 표적이 하마스이지 팔레스타인 민간인이 아니라고 주장.",
      countryDataRef: "영양부족률: 2.5%",
    },
    hi: {
      subject: "इज़राइल राज्य — प्रतिवादी, दक्षिण अफ्रीका v. इज़राइल [ISR]",
      accusation: "ICJ कार्यवाही (गाजा पट्टी में नरसंहार के अपराध की रोकथाम और दंड के लिए अभिसमय का लागू, दक्षिण अफ्रीका v. इज़राइल)। दक्षिण अफ्रीका आरोप लगाती है कि इज़राइल ने गाजा में फिलिस्तीनियों के खिलाफ नरसंहार किया है और कर रहा है, जो नरसंहार अभिसमय का उल्लंघन है। ICJ ने तीन सेट की अंतरिम उपाय जारी किए हैं, जिसमें इज़राइल को नरसंहार के कृत्यों को रोकने का आदेश दिया गया है (26 जनवरी 2024, 28 मार्च 2024, 24 मई 2024)।",
      evidence: [
        "ICJ अंतरिम उपाय आदेश (26 जनवरी 2024) — नरसंहार के संभावित जोखिम की पुष्टि की और इज़राइल को नरसंहार के कृत्यों को रोकने के लिए सभी उपाय करने का आदेश दिया",
        "ICJ अतिरिक्त अंतरिम उपाय (28 मार्च 2024 और 24 मई 2024) — अपूरणीय क्षति के आसन्न जोखिम की पुष्टि की और राफा में सैन्य अभियानों को रोकने का आदेश दिया",
        "संयुक्त राष्ट्र विशेष समिति की रिपोर्ट, इज़राइल के युद्ध तरीकों को नरसंहार की विशेषताओं के अनुरूप पाया (नवंबर 2024)",
        "OCHA हताहत और मानवीय डेटा: 40,000+ मारे गए, 96% आबादी विस्थापित, इंजीनियर की गई अकाल (2024)",
      ],
      rightOfResponse: "इज़राइल नरसंहार के आरोप को 'निराधार' बताकर अस्वीकार करता है और उसने प्रति-तर्क दाखिल किए हैं। इज़राइल का तर्क है कि सैन्य अभियान हमास को निशाना बनाते हैं, फिलिस्तीनी नागरिकों को नहीं।",
      countryDataRef: "कुपोषण: 2.5%",
    },
    ar: {
      subject: "دولة إسرائيل — المدعى عليها، جنوب أفريقيا ضد إسرائيل [ISR]",
      accusation: "إجراءات محكمة العدل الدولية (تطبيق اتفاقية منع جريمة الإبادة الجماعية والمعاقبة عليها في قطاع غزة، جنوب أفريقيا ضد إسرائيل). تزعم جنوب أفريقيا أن إسرائيل ارتكبت وترتكب إبادة جماعية ضد الفلسطينيين في غزة، منتهكة اتفاقية الإبادة الجماعية. أصدرت محكمة العدل الدولية ثلاث مجموعات من التدابير المؤقتة تأمر إسرائيل بمنع أفعال الإبادة الجماعية (26 يناير 2024، 28 مارس 2024، 24 مايو 2024).",
      evidence: [
        "أمر محكمة العدل الدولية بشأن التدابير المؤقتة (26 يناير 2024) — وجد خطراً معقولاً للإبادة الجماعية وأمر إسرائيل باتخاذ جميع التدابير لمنع أفعال الإبادة الجماعية",
        "تدابير مؤقتة إضافية لمحكمة العدل الدولية (28 مارس 2024 و24 مايو 2024) — وجدت خطراً وشيكاً لضرر لا يمكن إصلاحه وأمرت بوقف العمليات العسكرية في رفح",
        "تقرير اللجنة الخاصة للأمم المتحدة الذي وجد أن أساليب إسرائيل في الحرب متسقة مع خصائص الإبادة الجماعية (نوفمبر 2024)",
        "بيانات الضحايا والوضع الإنساني لـ OCHA: أكثر من 40,000 قتيل، 96% من السكان نازحون، مجاعة مفتعلة (2024)",
      ],
      rightOfResponse: "ترفض إسرائيل اتهام الإبادة الجماعية باعتباره 'لا أساس له' وقد قدمت مرافعات مضادة. تجادل إسرائيل بأن العمليات العسكرية تستهدف حماس وليس المدنيين الفلسطينيين.",
      countryDataRef: "سوء التغذية: 2.5%",
    },
    ru: {
      subject: "Государство Израиль — ответчик, ЮАР против Израиля [ISR]",
      accusation: "Производство МСУ (Применение Конвенции о предупреждении преступления геноцида и наказании за него в секторе Газа, ЮАР против Израиля). ЮАР утверждает, что Израиль совершил и совершает геноцид против палестинцев в Газе, нарушая Конвенцию о геноциде. МСУ выдал три комплекта временных мер, предписывающих Израилю предотвратить акты геноцида (26 января 2024 г., 28 марта 2024 г., 24 мая 2024 г.).",
      evidence: [
        "Распоряжение МСУ о временных мерах (26 января 2024 г.) — установило правдоподобный риск геноцида и предписало Израилю принять все меры для предотвращения актов геноцида",
        "Дополнительные временные меры МСУ (28 марта 2024 г. и 24 мая 2024 г.) — установили неизбежный риск непоправимого ущерба и предписали прекратить военные операции в Рафахе",
        "Доклад Специального комитета ООН, установивший, что методы ведения войны Израилем соответствуют характеристикам геноцида (ноябрь 2024 г.)",
        "Данные OCHA о жертвах и гуманитарной ситуации: более 40 000 убитых, 96% населения перемещено, искусственно созданный голод (2024 г.)",
      ],
      rightOfResponse: "Израиль отвергает обвинение в геноциде как «беспочвенное» и представил встречные аргументы. Израиль утверждает, что военные операции направлены против ХАМАС, а не против палестинских мирных жителей.",
      countryDataRef: "Недоедание: 2.5%",
    },
  },

  /* ═══════════════════════════════════════════════════════════════
     UN-01 — Rapid Support Forces (RSF) Leadership, Sudan
     ═══════════════════════════════════════════════════════════════ */
  "UN-01": {
    en: {
      subject: "Rapid Support Forces (RSF) Leadership — Sudan [SDN]",
      accusation: "UN Panel of Experts for Sudan and multiple independent investigations document systematic war crimes by the RSF during the Sudan civil war (2023-present): mass ethnic violence in Darfur (documented ethnic cleansing of the Masalit people), systematic sexual violence as a weapon of war, recruitment of child soldiers, looting of humanitarian aid, and deliberate obstruction of food supplies to civilian populations during famine conditions.",
      evidence: [
        "UN Panel of Experts on Sudan final report (S/2024/757, October 2024) documenting RSF war crimes and ethnic cleansing",
        "Human Rights Watch report 'The Massalit Will Not Come Home' — ethnic cleansing and crimes against humanity in El Geneina (May 2024)",
        "UN Security Council Resolution 2736 (2024) demanding RSF cease the siege of El Fasher",
        "Amnesty International investigation documenting RSF sexual violence as a weapon of war (February 2025)",
      ],
      rightOfResponse: "The RSF has denied allegations and accused the SAF of equivalent violations.",
      countryDataRef: "Conflict intensity: 5/5 · Displacement: 10.0M · Famine risk: 5/5",
    },
    pt: {
      subject: "Liderança das Forças de Apoio Rápido (RSF) — Sudão [SDN]",
      accusation: "O Painel de Especialistas da ONU para o Sudão e múltiplas investigações independentes documentam crimes de guerra sistemáticos pelas RSF durante a guerra civil do Sudão (2023-presente): violência étnica em massa em Darfur (limpeza étnica documentada do povo Masalit), violência sexual sistemática como arma de guerra, recrutamento de crianças-soldado, pilhagem de ajuda humanitária e obstrução deliberada de fornecimento de alimentos a populações civis durante condições de fome.",
      evidence: [
        "Relatório final do Painel de Especialistas da ONU sobre o Sudão (S/2024/757, outubro de 2024) documentando crimes de guerra e limpeza étnica das RSF",
        "Relatório da Human Rights Watch 'Os Massalit Não Voltarão para Casa' — limpeza étnica e crimes contra a humanidade em El Geneina (maio de 2024)",
        "Resolução 2736 (2024) do Conselho de Segurança da ONU exigindo que as RSF cessem o cerco a El Fasher",
        "Investigação da Anistia Internacional documentando violência sexual das RSF como arma de guerra (fevereiro de 2025)",
      ],
      rightOfResponse: "As RSF negaram as alegações e acusaram as SAF de violações equivalentes.",
      countryDataRef: "Intensidade do conflito: 5/5 · Deslocamento: 10.0M · Risco de fome: 5/5",
    },
    es: {
      subject: "Liderazgo de las Fuerzas de Apoyo Rápido (RSF) — Sudán [SDN]",
      accusation: "El Panel de Expertos de la ONU para Sudán y múltiples investigaciones independientes documentan crímenes de guerra sistemáticos por las RSF durante la guerra civil de Sudán (2023-presente): violencia étnica masiva en Darfur (limpieza étnica documentada del pueblo masalit), violencia sexual sistemática como arma de guerra, reclutamiento de niños soldado, saqueo de ayuda humanitaria y obstrucción deliberada de suministros de alimentos a poblaciones civiles durante condiciones de hambruna.",
      evidence: [
        "Informe final del Panel de Expertos de la ONU sobre Sudán (S/2024/757, octubre de 2024) documentando crímenes de guerra y limpieza étnica de las RSF",
        "Informe de Human Rights Watch 'Los Masalit No Volverán a Casa' — limpieza étnica y crímenes de lesa humanidad en El Geneina (mayo de 2024)",
        "Resolución 2736 (2024) del Consejo de Seguridad de la ONU exigiendo que las RSF cesen el asedio de El Fasher",
        "Investigación de Amnistía Internacional documentando la violencia sexual de las RSF como arma de guerra (febrero de 2025)",
      ],
      rightOfResponse: "Las RSF han negado las acusaciones y han acusado a las SAF de violaciones equivalentes.",
      countryDataRef: "Intensidad del conflicto: 5/5 · Desplazamiento: 10.0M · Riesgo de hambruna: 5/5",
    },
    fr: {
      subject: "Direction des Forces de soutien rapide (RSF) — Soudan [SDN]",
      accusation: "Le Groupe d'experts de l'ONU pour le Soudan et de multiples enquêtes indépendantes documentent des crimes de guerre systématiques par les RSF pendant la guerre civile soudanaise (2023-présent): violence ethnique de masse au Darfour (nettoyage ethnique documenté du peuple masalit), violence sexuelle systématique comme arme de guerre, recrutement d'enfants soldats, pillage de l'aide humanitaire et obstruction délibérée des fournitures alimentaires aux populations civiles pendant des conditions de famine.",
      evidence: [
        "Rapport final du Groupe d'experts de l'ONU sur le Soudan (S/2024/757, octobre 2024) documentant les crimes de guerre et le nettoyage ethnique des RSF",
        "Rapport de Human Rights Watch 'Les Massalit ne rentreront pas chez eux' — nettoyage ethnique et crimes contre l'humanité à El Geneina (mai 2024)",
        "Résolution 2736 (2024) du Conseil de sécurité de l'ONU exigeant que les RSF lèvent le siège d'El Fasher",
        "Enquête d'Amnesty International documentant la violence sexuelle des RSF comme arme de guerre (février 2025)",
      ],
      rightOfResponse: "Les RSF ont nié les allégations et accusé les SAF de violations équivalentes.",
      countryDataRef: "Intensité du conflit: 5/5 · Déplacement: 10.0M · Risque de famine: 5/5",
    },
    zh: {
      subject: "快速支援部队（RSF）领导层——苏丹 [SDN]",
      accusation: "联合国苏丹问题专家组及多项独立调查记录了RSF在苏丹内战（2023年至今）期间犯下的系统性战争罪行：达尔富尔的大规模种族暴力（有记录的对马萨利特人的种族清洗）、系统性将性暴力作为战争武器、招募儿童兵、掠夺人道主义援助，以及在饥荒条件下蓄意阻断对平民人口的食品供应。",
      evidence: [
        "联合国苏丹问题专家组最终报告（S/2024/757，2024年10月），记录RSF战争罪行和种族清洗",
        "人权观察组织报告《马萨利特人将无法回家》——朱奈纳的种族清洗和反人类罪（2024年5月）",
        "联合国安理会第2736号决议（2024年），要求RSF停止对法希尔的围困",
        "国际特赦组织调查，记录RSF将性暴力作为战争武器（2025年2月）",
      ],
      rightOfResponse: "RSF否认了指控，并指控SAF犯有同等违规行为。",
      countryDataRef: "冲突强度: 5/5 · 流离失所: 10.0M · 饥荒风险: 5/5",
    },
    ja: {
      subject: "即応支援部隊（RSF）指導部 — スーダン [SDN]",
      accusation: "国連スーダン専門家パネルおよび複数の独立調査が、スーダン内戦（2023年-現在）中のRSFによる組織的な戦争犯罪を記録：ダルフールでの大規模な民族暴力（マサリト族の民族浄化の記録）、戦争の武器としての組織的な性的暴力、子供兵士の募集、人道支援の略奪、飢饉状態下での民間人への食料供給の意図的妨害。",
      evidence: [
        "国連スーダン専門家パネル最終報告書（S/2024/757、2024年10月）によるRSFの戦争犯罪および民族浄化の記録",
        "ヒューマン・ライツ・ウォッチ報告書『マサリト人は家に帰れない』——エル・ゲネイナでの民族浄化と人道に対する犯罪（2024年5月）",
        "国連安全保障理事会決議2736（2024年）によるRSFへのエル・ファシェル包囲停止要求",
        "アムネスティ・インターナショナルの調査、戦争の武器としてのRSFの性的暴力を記録（2025年2月）",
      ],
      rightOfResponse: "RSFは容疑を否定し、SAFに対等な違反行為があると非難した。",
      countryDataRef: "紛争の激しさ: 5/5 · 避難者数: 10.0M · 飢饉リスク: 5/5",
    },
    ko: {
      subject: "신속지원군(RSF) 지도부 — 수단 [SDN]",
      accusation: "유엔 수단 전문가 패널 및 여러 독립 조사가 수단 내전(2023년-현재) 중 RSF의 조직적 전쟁 범죄를 기록함: 다르푸르에서의 대규모 종족 폭력(마살리트족의 종족 청소 기록), 전쟁 무기로서의 조직적 성폭력, 아동병 모집, 인도적 지원 약탈, 기근 상황에서 민간인에 대한 식량 공급의 의도적 방해.",
      evidence: [
        "유엔 수단 전문가 패널 최종 보고서(S/2024/757, 2024년 10월), RSF 전쟁 범죄 및 종족 청소 기록",
        "휴먼 라이츠 워치 보고서 '마살리트족은 집으로 돌아가지 못할 것' — 엘게네이나에서의 종족 청소 및 반인도적 범죄(2024년 5월)",
        "유엔 안전보장이사회 결의 2736(2024년), RSF에 엘파셰르 포위 중단 요구",
        "국제사면위원회 조사, 전쟁 무기로서의 RSF 성폭력 기록(2025년 2월)",
      ],
      rightOfResponse: "RSF는 혐의를 부인하고 SAF에게 동등한 위반 행위가 있다고 비난함.",
      countryDataRef: "갈등 강도: 5/5 · 실향민: 10.0M · 기근 위험: 5/5",
    },
    hi: {
      subject: "रैपिड सपोर्ट फोर्सेज (RSF) नेतृत्व — सूडान [SDN]",
      accusation: "सूडान के लिए संयुक्त राष्ट्र विशेषज्ञ पैनल और कई स्वतंत्र जांचें सूडान गृहयुद्ध (2023-वर्तमान) के दौरान RSF द्वारा किए गए व्यवस्थित युद्ध अपराधों का दस्तावेजीकरण करती हैं: दारफुर में बड़े पैमाने पर जातीय हिंसा (मसालित लोगों के जातीय सफाई का दस्तावेजीकरण), युद्ध के हथियार के रूप में व्यवस्थित यौन हिंसा, बाल सैनिकों की भर्ती, मानवीय सहायता की लूटपाट, और अकाल की स्थिति के दौरान नागरिक आबादी को खाद्य आपूर्ति में जानबूझकर बाधा।",
      evidence: [
        "सूडान पर संयुक्त राष्ट्र विशेषज्ञ पैनल की अंतिम रिपोर्ट (S/2024/757, अक्टूबर 2024), RSF युद्ध अपराधों और जातीय सफाई का दस्तावेजीकरण",
        "ह्यूमन राइट्स वॉच रिपोर्ट 'मसालित घर नहीं लौटेंगे' — एल गेनेना में जातीय सफाई और मानवता के खिलाफ अपराध (मई 2024)",
        "संयुक्त राष्ट्र सुरक्षा परिषद प्रस्ताव 2736 (2024), RSF से एल फाशेर की घेराबंदी बंद करने की मांग",
        "एमनेस्टी इंटरनेशनल की जांच, युद्ध के हथियार के रूप में RSF की यौन हिंसा का दस्तावेजीकरण (फरवरी 2025)",
      ],
      rightOfResponse: "RSF ने आरोपों से इनकार किया है और SAF पर समान उल्लंघनों का आरोप लगाया है।",
      countryDataRef: "संघर्ष की तीव्रता: 5/5 · विस्थापन: 10.0M · अकाल जोखिम: 5/5",
    },
    ar: {
      subject: "قيادة قوات الدعم السريع (RSF) — السودان [SDN]",
      accusation: "فريق الخبراء التابع للأمم المتحدة للسودان وعدة تحقيقات مستقلة توثق جرائم حرب منهجية ارتكبتها قوات الدعم السريع خلال الحرب الأهلية السودانية (2023-حتى الآن): عنف عرقي جماعي في دارفور (تطهير عرقي موثق لشعب المساليت)، عنف جنسي منهجي كسلاح حربي، تجنيد أطفال جنود، نهب المساعدات الإنسانية، والإعاقة المتعمدة لإمدادات الغذاء عن السكان المدنيين خلال ظروف المجاعة.",
      evidence: [
        "التقرير النهائي لفريق الخبراء التابع للأمم المتحدة بشأن السودان (S/2024/757، أكتوبر 2024) يوثق جرائم حرب قوات الدعم السريع والتطهير العرقي",
        "تقرير هيومن رايتس ووتش 'المساليت لن يعودوا إلى ديارهم' — التطهير العرقي والجرائم ضد الإنسانية في الجنينة (مايو 2024)",
        "قرار مجلس الأمن التابع للأمم المتحدة رقم 2736 (2024) يطالب قوات الدعم السريع بوقف حصار الفاشر",
        "تحقيق منظمة العفو الدولية يوثق العنف الجنسي لقوات الدعم السريع كسلاح حربي (فبراير 2025)",
      ],
      rightOfResponse: "نفت قوات الدعم السريع الاتهامات واتهمت القوات المسلحة السودانية بانتهاكات مماثلة.",
      countryDataRef: "شدة الصراع: 5/5 · النزوح: 10.0M · خطر المجاعة: 5/5",
    },
    ru: {
      subject: "Руководство Сил быстрого реагирования (RSF) — Судан [SDN]",
      accusation: "Группа экспертов ООН по Судану и множество независимых расследований фиксируют систематические военные преступления RSF во время гражданской войны в Судане (2023-наст. время): массовое этническое насилие в Дарфуре (задокументированная этническая чистка народа масалитов), систематическое сексуальное насилие как средство ведения войны, вербовка детей-солдат, разграбление гуманитарной помощи и преднамеренное воспрепятствование поставкам продовольствия гражданскому населению в условиях голода.",
      evidence: [
        "Итоговый доклад Группы экспертов ООН по Судану (S/2024/757, октябрь 2024 г.), зафиксировавший военные преступления и этнические чистки RSF",
        "Доклад Human Rights Watch «Масалиты не вернутся домой» — этнические чистки и преступления против человечности в Эль-Генейне (май 2024 г.)",
        "Резолюция 2736 (2024) Совета Безопасности ООН, требующая от RSF прекратить осаду Эль-Фашера",
        "Расследование Amnesty International, зафиксировавшее сексуальное насилие RSF как средство ведения войны (февраль 2025 г.)",
      ],
      rightOfResponse: "RSF отвергли обвинения и обвинили SAF в аналогичных нарушениях.",
      countryDataRef: "Интенсивность конфликта: 5/5 · Перемещение: 10.0M · Риск голода: 5/5",
    },
  },
};

export function td(id: string, lang: Lang): DossierI18n {
  return DOSSIER_I18N[id]?.[lang] ?? DOSSIER_I18N[id]?.en ?? { subject: id, accusation: "", evidence: [], rightOfResponse: "", countryDataRef: "" };
}
