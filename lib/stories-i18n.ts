/**
 * V FOR X — Story content translations (10 languages)
 *
 * Full i18n for all 4 guided narrative stories.
 *
 * Supported languages: en, pt, es, fr, zh, ja, ko, hi, ar, ru
 */

import type { Lang } from "./i18n";

export interface StoryStepI18n {
  title: string;
  text: string;
  dataLabel?: string;
  linkLabel?: string;
}

export interface StoryI18n {
  title: string;
  duration: string;
  steps: StoryStepI18n[];
}

export const STORY_I18N: Record<string, Partial<Record<Lang, StoryI18n>>> = {
  /* ═══════════════════════════════════════════════════════════════
   * WATER — The Water Crisis
   * ═══════════════════════════════════════════════════════════════ */
  water: {
    en: {
      title: "The Water Crisis",
      duration: "5 min",
      steps: [
        {
          title: "The Gap",
          text: "2 billion people lack safe water. 3.9 billion lack safely managed sanitation. That's over half of humanity without a toilet.",
          dataLabel: "without safe sanitation",
        },
        {
          title: "The 10 Worst Countries",
          text: "In countries like South Sudan and Chad, less than 30% of the population has access to safe sanitation. Open defecation is the norm, not the exception.",
          linkLabel: "→ See vulnerability ranking",
        },
        {
          title: "The Blueprint",
          text: "Solar water purification requires nothing but clear plastic bottles and sunlight. No chemicals, no electricity, no filters. WHO-validated. Deployable today.",
          linkLabel: "→ Read the blueprint",
        },
        {
          title: "The Equation",
          text: "The cost to fix this: $114 billion per year. That's 17 days of world military spending. Less than 5% of what the world spends on weapons.",
          dataLabel: "= 17 days of military spending",
          linkLabel: "→ See the full equation",
        },
        {
          title: "The Action",
          text: "Don't just read these numbers. Use them. Generate a campaign kit — tweets, emails, printable briefs — all pre-filled with real data. Copy. Send. Act.",
          linkLabel: "→ Generate campaign kit",
        },
      ],
    },
    pt: {
      title: "A Crise da Água",
      duration: "5 min",
      steps: [
        {
          title: "A Lacuna",
          text: "2 bilhões de pessoas não têm água potável. 3,9 bilhões não têm saneamento gerenciado de forma segura. Isso é mais da metade da humanidade sem banheiro.",
          dataLabel: "sem saneamento seguro",
        },
        {
          title: "Os 10 Piores Países",
          text: "Em países como Sudão do Sul e Chade, menos de 30% da população tem acesso a saneamento seguro. A defecação a céu aberto é a norma, não a exceção.",
          linkLabel: "→ Ver ranking de vulnerabilidade",
        },
        {
          title: "O Plano",
          text: "A purificação solar da água não requer nada além de garrafas plásticas transparentes e luz solar. Sem produtos químicos, sem eletricidade, sem filtros. Validado pela OMS. Implementável hoje.",
          linkLabel: "→ Ler o plano",
        },
        {
          title: "A Equação",
          text: "O custo para resolver isso: $114 bilhões por ano. Isso são 17 dias de gastos militares mundiais. Menos de 5% do que o mundo gasta com armas.",
          dataLabel: "= 17 dias de gastos militares",
          linkLabel: "→ Ver a equação completa",
        },
        {
          title: "A Ação",
          text: "Não apenas leia estes números. Use-os. Gere um kit de campanha — tweets, e-mails, resumos para impressão — todos pré-preenchidos com dados reais. Copie. Envie. Aja.",
          linkLabel: "→ Gerar kit de campanha",
        },
      ],
    },
    es: {
      title: "La Crisis del Agua",
      duration: "5 min",
      steps: [
        {
          title: "La Brecha",
          text: "2 mil millones de personas carecen de agua potable. 3,9 mil millones carecen de saneamiento gestionado de forma segura. Eso es más de la mitad de la humanidad sin inodoro.",
          dataLabel: "sin saneamiento seguro",
        },
        {
          title: "Los 10 Peores Países",
          text: "En países como Sudán del Sur y Chad, menos del 30% de la población tiene acceso a saneamiento seguro. La defecación al aire libre es la norma, no la excepción.",
          linkLabel: "→ Ver ranking de vulnerabilidad",
        },
        {
          title: "El Plan",
          text: "La purificación solar del agua no requiere nada más que botellas de plástico transparentes y luz solar. Sin químicos, sin electricidad, sin filtros. Validado por la OMS. Desplegable hoy.",
          linkLabel: "→ Leer el plan",
        },
        {
          title: "La Ecuación",
          text: "El costo para solucionar esto: $114 mil millones por año. Eso son 17 días de gasto militar mundial. Menos del 5% de lo que el mundo gasta en armas.",
          dataLabel: "= 17 días de gasto militar",
          linkLabel: "→ Ver la ecuación completa",
        },
        {
          title: "La Acción",
          text: "No te limites a leer estos números. Úsalos. Genera un kit de campaña — tweets, correos, resúmenes imprimibles — todos prellenados con datos reales. Copia. Envía. Actúa.",
          linkLabel: "→ Generar kit de campaña",
        },
      ],
    },
    fr: {
      title: "La Crise de l'Eau",
      duration: "5 min",
      steps: [
        {
          title: "L'Écart",
          text: "2 milliards de personnes manquent d'eau potable. 3,9 milliards manquent d'assainissement géré en toute sécurité. C'est plus de la moitié de l'humanité sans toilettes.",
          dataLabel: "sans assainissement sûr",
        },
        {
          title: "Les 10 Pires Pays",
          text: "Dans des pays comme le Soudan du Sud et le Tchad, moins de 30 % de la population a accès à un assainissement sûr. La défécation à l'air libre est la norme, pas l'exception.",
          linkLabel: "→ Voir le classement de vulnérabilité",
        },
        {
          title: "Le Plan",
          text: "La purification solaire de l'eau ne nécessite rien d'autre que des bouteilles en plastique transparent et la lumière du soleil. Pas de produits chimiques, pas d'électricité, pas de filtres. Validé par l'OMS. Déployable dès aujourd'hui.",
          linkLabel: "→ Lire le plan",
        },
        {
          title: "L'Équation",
          text: "Le coût pour y remédier : 114 milliards de dollars par an. C'est 17 jours de dépenses militaires mondiales. Moins de 5 % de ce que le monde dépense en armes.",
          dataLabel: "= 17 jours de dépenses militaires",
          linkLabel: "→ Voir l'équation complète",
        },
        {
          title: "L'Action",
          text: "Ne vous contentez pas de lire ces chiffres. Utilisez-les. Générez un kit de campagne — tweets, e-mails, résumés imprimables — tous pré-remplis avec des données réelles. Copiez. Envoyez. Agissez.",
          linkLabel: "→ Générer un kit de campagne",
        },
      ],
    },
    zh: {
      title: "水危机",
      duration: "5分钟",
      steps: [
        {
          title: "差距",
          text: "20亿人缺乏安全饮用水。39亿人缺乏安全管理的卫生设施。这意味着超过一半的人类没有厕所。",
          dataLabel: "缺乏安全卫生设施",
        },
        {
          title: "最严重的10个国家",
          text: "在南苏丹和乍得等国家，不到30%的人口能够获得安全的卫生设施。露天排便不是例外，而是常态。",
          linkLabel: "→ 查看脆弱性排名",
        },
        {
          title: "方案",
          text: "太阳能净水只需要透明塑料瓶和阳光。无需化学药剂，无需电力，无需过滤。经世界卫生组织验证。今天就能部署。",
          linkLabel: "→ 阅读方案",
        },
        {
          title: "等式",
          text: "解决这个问题的成本：每年1140亿美元。这是全球17天的军费开支。不到全球武器开支的5%。",
          dataLabel: "= 17天的军费开支",
          linkLabel: "→ 查看完整等式",
        },
        {
          title: "行动",
          text: "不要只是阅读这些数字。利用它们。生成活动工具包——推文、电子邮件、可打印简报——全部预填真实数据。复制。发送。行动。",
          linkLabel: "→ 生成活动工具包",
        },
      ],
    },
    ja: {
      title: "水の危機",
      duration: "5分",
      steps: [
        {
          title: "格差",
          text: "20億人が安全な水を欠いています。39億人が安全に管理された衛生設備を欠いています。それは人類の半数以上がトイレなしということです。",
          dataLabel: "安全な衛生設備なし",
        },
        {
          title: "最悪の10カ国",
          text: "南スーダンやチャドなどの国々では、人口の30%未満しか安全な衛生設備にアクセスできません。野糞は例外ではなく、日常です。",
          linkLabel: "→ 脆弱性ランキングを見る",
        },
        {
          title: "設計図",
          text: "太陽光浄水は透明なペットボトルと太陽の光だけで機能します。薬品不要、電力不要、フィルター不要。WHO認証済み。今日から展開可能。",
          linkLabel: "→ 設計図を読む",
        },
        {
          title: "方程式",
          text: "これを解決するコスト：年額1140億ドル。それは世界の軍事費の17日分です。世界が兵器に使う金額の5%未満です。",
          dataLabel: "= 軍事費の17日分",
          linkLabel: "→ 完全な方程式を見る",
        },
        {
          title: "行動",
          text: "数字をただ読むだけで終わらせないでください。活用してください。キャンペーンキットを生成しましょう——ツイート、メール、印刷用ブリーフ——すべて実データが事前入力されています。コピー。送信。行動。",
          linkLabel: "→ キャンペーンキットを生成",
        },
      ],
    },
    ko: {
      title: "물 위기",
      duration: "5분",
      steps: [
        {
          title: "격차",
          text: "20억 명이 안전한 물을 갖지 못하고 있습니다. 39억 명이 안전하게 관리되는 위생 시설을 갖지 못하고 있습니다. 이는 인류의 절반 이상이 화장실 없이 살고 있다는 뜻입니다.",
          dataLabel: "안전한 위생 시설 없음",
        },
        {
          title: "가장 심각한 10개국",
          text: "남수단과 차드 같은 국가에서는 인구의 30% 미만만이 안전한 위생 시설에 접근할 수 있습니다. 야외 배변은 예외가 아니라 일상입니다.",
          linkLabel: "→ 취약성 순위 보기",
        },
        {
          title: "청사진",
          text: "태양광 정수는 투명한 플라스틱 병과 햇빛만 있으면 됩니다. 화학물질 불필요, 전력 불필요, 필터 불필요. WHO 검증 완료. 오늘 바로 배포 가능.",
          linkLabel: "→ 청사진 읽기",
        },
        {
          title: "방정식",
          text: "이것을 해결하는 비용: 연간 1140억 달러. 이는 세계 군사비 지출의 17일 분량입니다. 전 세계가 무기에 쓰는 금액의 5% 미만입니다.",
          dataLabel: "= 군사비 17일 분량",
          linkLabel: "→ 전체 방정식 보기",
        },
        {
          title: "행동",
          text: "이 숫자들을 그저 읽지 마세요. 활용하세요. 캠페인 키트를 생성하세요 — 트윗, 이메일, 인쇄용 브리프 — 모두 실제 데이터로 미리 채워집니다. 복사. 발송. 행동.",
          linkLabel: "→ 캠페인 키트 생성",
        },
      ],
    },
    hi: {
      title: "जल संकट",
      duration: "5 मिनट",
      steps: [
        {
          title: "अंतर",
          text: "2 अरब लोगों के पास सुरक्षित पानी नहीं है। 3.9 अरब लोगों के पास सुरक्षित रूप से प्रबंधित स्वच्छता नहीं है। यानी मानवता के आधे से अधिक के पास शौचालय नहीं है।",
          dataLabel: "सुरक्षित स्वच्छता के बिना",
        },
        {
          title: "10 सबसे बुरे देश",
          text: "दक्षिण सूडान और चाड जैसे देशों में, 30% से कम आबादी को सुरक्षित स्वच्छता तक पहुंच है। खुले में शौच करना अपवाद नहीं, नियम है।",
          linkLabel: "→ भेद्यता रैंकिंग देखें",
        },
        {
          title: "योजना",
          text: "सौर जल शुद्धिकरण के लिए केवल पारदर्शी प्लास्टिक की बोतलें और धूप चाहिए। कोई रसायन नहीं, कोई बिजली नहीं, कोई फिल्टर नहीं। WHO द्वारा सत्यापित। आज ही तैनात करने योग्य।",
          linkLabel: "→ योजना पढ़ें",
        },
        {
          title: "समीकरण",
          text: "इसे ठीक करने की लागत: हर साल $114 अरब। यह विश्व के सैन्य खर्च के 17 दिनों के बराबर है। दुनिया जितना हथियारों पर खर्च करती है, उसका 5% से भी कम।",
          dataLabel: "= 17 दिनों का सैन्य खर्च",
          linkLabel: "→ पूरा समीकरण देखें",
        },
        {
          title: "कार्रवाई",
          text: "इन संख्याओं को केवल मत पढ़ो। उनका उपयोग करो। एक अभियान किट तैयार करो — ट्वीट, ईमेल, मुद्रण योग्य संक्षिप्त विवरण — सभी वास्तविक डेटा से पहले से भरे हुए। कॉपी करो। भेजो। कार्रवाई करो।",
          linkLabel: "→ अभियान किट तैयार करें",
        },
      ],
    },
    ar: {
      title: "أزمة المياه",
      duration: "5 دقيقة",
      steps: [
        {
          title: "الفجوة",
          text: "2 مليار شخص يفتقرون إلى مياه آمنة. 3.9 مليار يفتقرون إلى مرافق صرف صحي مُدارة بأمان. هذا أكثر من نصف البشرية بدون مرحاض.",
          dataLabel: "بدون صرف صحي آمن",
        },
        {
          title: "أسوأ 10 دول",
          text: "في دول مثل جنوب السودان وتشاد، أقل من 30% من السكان لديهم accès إلى صرف صحي آمن. التغوّط في العراء هو القاعدة لا الاستثناء.",
          linkLabel: "→ عرض ترتيب الهشاشة",
        },
        {
          title: "المخطط",
          text: "تنقية المياه بالطاقة الشمسية لا تتطلب سوى زجاجات بلاستيكية شفافة وضوء الشمس. لا مواد كيميائية، لا كهرباء، لا فلاتر. معتمد من منظمة الصحة العالمية. قابل للتطبيق اليوم.",
          linkLabel: "→ اقرأ المخطط",
        },
        {
          title: "المعادلة",
          text: "تكلفة حل هذه المشكلة: 114 مليار دولار سنوياً. هذا يعادل 17 يوماً من الإنفاق العسكري العالمي. أقل من 5% مما ينفقه العالم على الأسلحة.",
          dataLabel: "= 17 يوماً من الإنفاق العسكري",
          linkLabel: "→ عرض المعادلة الكاملة",
        },
        {
          title: "الإجراء",
          text: "لا تكتفي بقراءة هذه الأرقام. استخدمها. أنشئ حزمة حملة — تغريدات، رسائل بريد إلكتروني، ملخصات قابلة للطباعة — جميعها مملوءة مسبقاً ببيانات حقيقية. انسخ. أرسل. تصرّف.",
          linkLabel: "→ إنشاء حزمة الحملة",
        },
      ],
    },
    ru: {
      title: "Кризис Воды",
      duration: "5 мин",
      steps: [
        {
          title: "Разрыв",
          text: "2 миллиарда человек не имеют безопасной воды. 3,9 миллиарда не имеют безопасно управляемой канализации. Это более половины человечества без туалета.",
          dataLabel: "без безопасной канализации",
        },
        {
          title: "10 Худших Стран",
          text: "В таких странах, как Южный Судан и Чад, менее 30% населения имеют доступ к безопасной канализации. Открытая дефекация — норма, а не исключение.",
          linkLabel: "→ Смотреть рейтинг уязвимости",
        },
        {
          title: "План",
          text: "Солнечная очистка воды не требует ничего, кроме прозрачных пластиковых бутылок и солнечного света. Никаких химикатов, никакого электричества, никаких фильтров. Одобрено ВОЗ. Готово к развёртыванию сегодня.",
          linkLabel: "→ Читать план",
        },
        {
          title: "Уравнение",
          text: "Стоимость решения: 114 миллиардов долларов в год. Это 17 дней мировых военных расходов. Менее 5% того, что мир тратит на оружие.",
          dataLabel: "= 17 дней военных расходов",
          linkLabel: "→ Смотреть полное уравнение",
        },
        {
          title: "Действие",
          text: "Не просто читайте эти цифры. Используйте их. Создайте набор для кампании — твиты, электронные письма, печатные сводки — все предварительно заполнены реальными данными. Копируйте. Отправляйте. Действуйте.",
          linkLabel: "→ Создать набор для кампании",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════
   * HUNGER — The Hunger Equation
   * ═══════════════════════════════════════════════════════════════ */
  hunger: {
    en: {
      title: "The Hunger Equation",
      duration: "4 min",
      steps: [
        {
          title: "The Number",
          text: "667 million people are undernourished right now. That's 1 in 11 humans on Earth. Every single one of them is preventable.",
          dataLabel: "undernourished in 2024",
        },
        {
          title: "The Worst Crises",
          text: "Sudan, South Sudan, Palestine, Yemen, Somalia — these are the front lines. In some, famine has already been declared. In others, it's imminent.",
          linkLabel: "→ Explore the Sorrow Map",
        },
        {
          title: "The Cost",
          text: "$93 billion per year. Not $93 trillion. Not even $930 billion. $93B. That's 0.9% of world military spending. 14 days.",
          dataLabel: "= 14 days of military spending",
        },
        {
          title: "The ROI",
          text: "School feeding programs return $7-35 for every $1 invested. Smallholder agriculture increases income by 34% and production by 35%. These aren't opinions — they're measured returns.",
          linkLabel: "→ See the evidence",
        },
        {
          title: "The Structural Blockers",
          text: "Armed conflict blocks aid. Corruption diverts resources. Climate change destroys harvests. The money exists — the system is designed to fail.",
          linkLabel: "→ Document accountability",
        },
      ],
    },
    pt: {
      title: "A Equação da Fome",
      duration: "4 min",
      steps: [
        {
          title: "O Número",
          text: "667 milhões de pessoas estão desnutridas agora mesmo. Isso é 1 em cada 11 humanos na Terra. Cada um deles é evitável.",
          dataLabel: "desnutridos em 2024",
        },
        {
          title: "As Piores Crises",
          text: "Sudão, Sudão do Sul, Palestina, Iêmen, Somália — estas são as linhas de frente. Em algumas, a fome já foi declarada. Em outras, é iminente.",
          linkLabel: "→ Explorar o Mapa da Dor",
        },
        {
          title: "O Custo",
          text: "$93 bilhões por ano. Não $93 trilhões. Nem mesmo $930 bilhões. $93B. Isso é 0,9% dos gastos militares mundiais. 14 dias.",
          dataLabel: "= 14 dias de gastos militares",
        },
        {
          title: "O Retorno",
          text: "Programas de alimentação escolar retornam $7-35 para cada $1 investido. A agricultura familiar aumenta a renda em 34% e a produção em 35%. Estas não são opiniões — são retornos medidos.",
          linkLabel: "→ Ver as evidências",
        },
        {
          title: "Os Bloqueios Estruturais",
          text: "Conflito armado bloqueia ajuda. Corrupção desvia recursos. Mudança climática destrói colheitas. O dinheiro existe — o sistema é projetado para falhar.",
          linkLabel: "→ Documentar responsabilização",
        },
      ],
    },
    es: {
      title: "La Ecuación del Hambre",
      duration: "4 min",
      steps: [
        {
          title: "El Número",
          text: "667 millones de personas están desnutridas ahora mismo. Eso es 1 de cada 11 humanos en la Tierra. Cada uno de ellos es prevenible.",
          dataLabel: "desnutridos en 2024",
        },
        {
          title: "Las Peores Crisis",
          text: "Sudán, Sudán del Sur, Palestina, Yemen, Somalia — estas son las líneas del frente. En algunas, la hambruna ya ha sido declarada. En otras, es inminente.",
          linkLabel: "→ Explorar el Mapa del Dolor",
        },
        {
          title: "El Costo",
          text: "$93 mil millones por año. No $93 billones. Ni siquiera $930 mil millones. $93B. Eso es 0,9% del gasto militar mundial. 14 días.",
          dataLabel: "= 14 días de gasto militar",
        },
        {
          title: "El Retorno",
          text: "Los programas de alimentación escolar generan $7-35 por cada $1 invertido. La agricultura familiar aumenta los ingresos en 34% y la producción en 35%. Estas no son opiniones — son retornos medidos.",
          linkLabel: "→ Ver las evidencias",
        },
        {
          title: "Los Bloqueos Estructurales",
          text: "El conflicto armado bloquea la ayuda. La corrupción desvía recursos. El cambio climático destruye cosechas. El dinero existe — el sistema está diseñado para fallar.",
          linkLabel: "→ Documentar la rendición de cuentas",
        },
      ],
    },
    fr: {
      title: "L'Équation de la Faim",
      duration: "4 min",
      steps: [
        {
          title: "Le Chiffre",
          text: "667 millions de personnes souffrent de sous-nutrition en ce moment. C'est 1 humain sur 11 sur Terre. Chacun d'entre eux est évitable.",
          dataLabel: "sous-alimentés en 2024",
        },
        {
          title: "Les Pires Crises",
          text: "Soudan, Soudan du Sud, Palestine, Yémen, Somalie — ce sont les lignes de front. Dans certains, la famine a déjà été déclarée. Dans d'autres, elle est imminente.",
          linkLabel: "→ Explorer la Carte de la Douleur",
        },
        {
          title: "Le Coût",
          text: "93 milliards de dollars par an. Pas 93 trillions. Pas même 930 milliards. 93 milliards. C'est 0,9 % des dépenses militaires mondiales. 14 jours.",
          dataLabel: "= 14 jours de dépenses militaires",
        },
        {
          title: "Le Retour sur Investissement",
          text: "Les programmes de cantine scolaire rapportent 7 à 35 $ pour chaque dollar investi. L'agriculture paysanne augmente les revenus de 34 % et la production de 35 %. Ce ne sont pas des opinions — ce sont des rendements mesurés.",
          linkLabel: "→ Voir les preuves",
        },
        {
          title: "Les Blocages Structurels",
          text: "Les conflits armés bloquent l'aide. La corruption détourne les ressources. Le changement climatique détruit les récoltes. L'argent existe — le système est conçu pour échouer.",
          linkLabel: "→ Documenter la responsabilité",
        },
      ],
    },
    zh: {
      title: "饥饿等式",
      duration: "4分钟",
      steps: [
        {
          title: "数字",
          text: "目前有6.67亿人营养不良。这意味着地球上每11人中就有1人。每一个都是可以预防的。",
          dataLabel: "2024年营养不良人数",
        },
        {
          title: "最严重的危机",
          text: "苏丹、南苏丹、巴勒斯坦、也门、索马里——这些是最前线。在部分国家，饥荒已经被宣布。在另一些国家，它迫在眉睫。",
          linkLabel: "→ 探索悲伤地图",
        },
        {
          title: "成本",
          text: "每年930亿美元。不是93万亿。甚至不是9300亿。930亿。这是全球军费开支的0.9%。14天。",
          dataLabel: "= 14天的军费开支",
        },
        {
          title: "回报率",
          text: "学校供餐项目每投入1美元可回报7至35美元。小农农业使收入增加34%，产量增加35%。这些不是观点——而是经过衡量的回报。",
          linkLabel: "→ 查看证据",
        },
        {
          title: "结构性障碍",
          text: "武装冲突阻碍援助。腐败转移资源。气候变化摧毁收成。钱是存在的——是这个系统注定失败。",
          linkLabel: "→ 记录问责",
        },
      ],
    },
    ja: {
      title: "飢餑の方程式",
      duration: "4分",
      steps: [
        {
          title: "数字",
          text: "現在6億6700万人が栄養不足です。それは地球上の11人に1人です。その一人一人が防げたはずです。",
          dataLabel: "2024年の栄養不足者数",
        },
        {
          title: "最悪の危機",
          text: "スーダン、南スーダン、パレスチナ、イエメン、ソマリア——これらが最前線です。一部では飢饉がすでに宣言されています。他では差し迫っています。",
          linkLabel: "→ 悲哀の地図を探る",
        },
        {
          title: "コスト",
          text: "年額930億ドル。93兆ドルではありません。9300億ドルですらありません。930億ドル。これは世界の軍事費の0.9%です。14日分です。",
          dataLabel: "= 軍事費の14日分",
        },
        {
          title: "投資収益率",
          text: "学校給食プログラムは投資1ドルにつき7〜35ドルのリターンを生みます。小規模農業は収入を34%、生産を35%増加させます。これらは意見ではなく、測定されたリターンです。",
          linkLabel: "→ 証拠を見る",
        },
        {
          title: "構造的障壁",
          text: "武力紛争が援助を阻みます。汚職が資源を横流しします。気候変動が収穫を破壊します。お金は存在します——システムが失敗するように設計されているのです。",
          linkLabel: "→ 責任追及を記録する",
        },
      ],
    },
    ko: {
      title: "기아 방정식",
      duration: "4분",
      steps: [
        {
          title: "숫자",
          text: "현재 6억 6,700만 명이 영양 부족 상태입니다. 이는 지구상 11명 중 1명입니다. 그 모든 경우는 예방 가능합니다.",
          dataLabel: "2024년 영양 부족자",
        },
        {
          title: "최악의 위기",
          text: "수단, 남수단, 팔레스타인, 예멘, 소말리아 — 이곳이 최전선입니다. 일부에서는 기근이 이미 선언되었습니다. 다른 곳에서는 임박했습니다.",
          linkLabel: "→ 슬픔의 지도 탐색",
        },
        {
          title: "비용",
          text: "연간 930억 달러. 93조 달러가 아닙니다. 9300억 달러조차 아닙니다. 930억 달러. 이는 세계 군사비 지출의 0.9%입니다. 14일 분량입니다.",
          dataLabel: "= 군사비 14일 분량",
        },
        {
          title: "투자 수익률",
          text: "학교 급식 프로그램은 투자 1달러당 7~35달러를 회수합니다. 소농 농업은 소득을 34%, 생산을 35% 증가시킵니다. 이것은 의견이 아니라 측정된 수익입니다.",
          linkLabel: "→ 증거 보기",
        },
        {
          title: "구조적 장벽",
          text: "무력 충돌이 원조를 차단합니다. 부패가 자원을 전용합니다. 기후 변화가 수확을 파괴합니다. 돈은 존재합니다 — 시스템이 실패하도록 설계되어 있습니다.",
          linkLabel: "→ 책임성 기록",
        },
      ],
    },
    hi: {
      title: "भुखमरी समीकरण",
      duration: "4 मिनट",
      steps: [
        {
          title: "संख्या",
          text: "अभी 667 मिलियन लोग कुपोषित हैं। यानी पृथ्वी पर हर 11 में से 1 इंसान। इनमें से हर एक को रोका जा सकता था।",
          dataLabel: "2024 में कुपोषित",
        },
        {
          title: "सबसे बुरे संकट",
          text: "सूडान, दक्षिण सूडान, फिलिस्तीन, यमन, सोमालिया — ये मोर्चे हैं। कुछ में अकाल पहले ही घोषित कर दिया गया है। अन्य में, यह निकट है।",
          linkLabel: "→ दुःख मानचित्र खोजें",
        },
        {
          title: "लागत",
          text: "हर साल $93 अरब। $93 खरब नहीं। $930 अरब भी नहीं। $93B। यह विश्व सैन्य खर्च का 0.9% है। 14 दिन।",
          dataLabel: "= 14 दिनों का सैन्य खर्च",
        },
        {
          title: "प्रतिफल",
          text: "स्कूल भोजन कार्यक्रम प्रति $1 निवेश पर $7-35 लौटाते हैं। लघु कृषि आय में 34% और उत्पादन में 35% की वृद्धि करती है। ये राय नहीं हैं — ये मापे गए प्रतिफल हैं।",
          linkLabel: "→ साक्ष्य देखें",
        },
        {
          title: "संरचनात्मक बाधाएं",
          text: "सशस्त्र संघर्ष सहायता को रोकता है। भ्रष्टाचार संसाधनों को भटकाता है। जलवायु परिवर्तन फसलों को नष्ट करता है। पैसा मौजूद है — यह व्यवस्था विफल होने के लिए डिज़ाइन की गई है।",
          linkLabel: "→ जवाबदेही दर्ज करें",
        },
      ],
    },
    ar: {
      title: "معادلة الجوع",
      duration: "4 دقيقة",
      steps: [
        {
          title: "الرقم",
          text: "667 مليون شخص يعانون من سوء التغذية الآن. هذا يعني 1 من كل 11 إنساناً على الأرض. كل واحد منهم يمكن منعه.",
          dataLabel: "سوء التغذية في 2024",
        },
        {
          title: "أسوأ الأزمات",
          text: "السودان، جنوب السودان، فلسطين، اليمن، الصومال — هذه هي الخطوط الأمامية. في بعضها، أُعلن المجاعة بالفعل. في أخرى، هي وشيكة.",
          linkLabel: "→ استكشاف خريطة الأحزان",
        },
        {
          title: "التكلفة",
          text: "93 مليار دولار سنوياً. ليس 93 تريليون. ولا حتى 930 مليار. 93 مليار. هذا يمثل 0.9% من الإنفاق العسكري العالمي. 14 يوماً.",
          dataLabel: "= 14 يوماً من الإنفاق العسكري",
        },
        {
          title: "العائد على الاستثمار",
          text: "برامج التغذية المدرسية تحقق عائداً قدره 7-35 دولاراً مقابل كل دولار مستثمر. الزراعة الأسرية تزيد الدخل بنسبة 34% والإنتاج بنسبة 35%. هذه ليست آراء — بل عوائد مقاسة.",
          linkLabel: "→ عرض الأدلة",
        },
        {
          title: "العوائق الهيكلية",
          text: "النزاع المسلح يمنع المساعدات. الفساد يحوّل الموارد. تغير المناخ يدمر المحاصيل. المال موجود — النظام مصمم للفشل.",
          linkLabel: "→ توثيق المساءلة",
        },
      ],
    },
    ru: {
      title: "Уравнение Голода",
      duration: "4 мин",
      steps: [
        {
          title: "Число",
          text: "667 миллионов человек страдают от недоедания прямо сейчас. Это 1 из 11 человек на Земле. Каждый из них предотвратим.",
          dataLabel: "недоедающих в 2024 году",
        },
        {
          title: "Худшие Кризисы",
          text: "Судан, Южный Судан, Палестина, Йемен, Сомали — это линии фронта. В некоторых уже объявлен голод. В других он неизбежен.",
          linkLabel: "→ Исследовать Карту Скорби",
        },
        {
          title: "Стоимость",
          text: "93 миллиарда долларов в год. Не 93 триллиона. Даже не 930 миллиардов. 93 миллиарда. Это 0,9% мировых военных расходов. 14 дней.",
          dataLabel: "= 14 дней военных расходов",
        },
        {
          title: "Окупаемость",
          text: "Программы школьного питания приносят 7-35 долларов на каждый вложенный доллар. Мелкое фермерство увеличивает доходы на 34% и производство на 35%. Это не мнения — это измеренная отдача.",
          linkLabel: "→ Смотреть доказательства",
        },
        {
          title: "Структурные Барьеры",
          text: "Вооружённые конфликты блокируют помощь. Коррупция перенаправляет ресурсы. Изменение климата уничтожает урожаи. Деньги есть — система создана, чтобы терпеть неудачу.",
          linkLabel: "→ Задокументировать ответственность",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════
   * INEQUALITY — The Inequality Machine
   * ═══════════════════════════════════════════════════════════════ */
  inequality: {
    en: {
      title: "The Inequality Machine",
      duration: "5 min",
      steps: [
        {
          title: "The Gap",
          text: "The richest 1% hold more wealth than the bottom 50%. The money exists. The system redistributes it upward. This is not natural — it's designed.",
          dataLabel: "billionaire wealth (USD)",
        },
        {
          title: "The Doctor Gap",
          text: "Norway has 4.8 doctors per 1,000. The Central African Republic has 0.1. A 48x gap. The WHO minimum is 4.45. 186 of 194 countries are below it.",
          linkLabel: "→ Compare countries",
        },
        {
          title: "The Climate Injustice",
          text: "Qatar emits 41 tons of CO2 per person. The DRC emits 0.05. A 764x gap. The countries least responsible for climate change will suffer its worst consequences.",
          dataLabel: "CO2 gap: Qatar vs DRC",
        },
        {
          title: "The Solution",
          text: "A 2% tax on the world's 3,000 billionaires raises $313B/year. That's enough to end extreme poverty AND fund water, electricity, and education for everyone. With $50B left over.",
          dataLabel: "from a 2% billionaire tax",
          linkLabel: "→ See the equation",
        },
        {
          title: "The Combined Fix",
          text: "$422B/year buys safe water + healthcare + electricity + education for every human alive. That's 64 days of military spending. 17.5%. The question isn't whether we can afford it.",
          dataLabel: "= 64 days of military spending",
          linkLabel: "→ Take action",
        },
      ],
    },
    pt: {
      title: "A Máquina da Desigualdade",
      duration: "5 min",
      steps: [
        {
          title: "A Lacuna",
          text: "Os 1% mais ricos possuem mais riqueza do que os 50% mais pobres. O dinheiro existe. O sistema o redistribui para cima. Isso não é natural — é projetado.",
          dataLabel: "riqueza de bilionários (USD)",
        },
        {
          title: "A Lacuna Médica",
          text: "A Noruega tem 4,8 médicos por 1.000 habitantes. A República Centro-Africana tem 0,1. Uma diferença de 48x. O mínimo da OMS é 4,45. 186 dos 194 países estão abaixo disso.",
          linkLabel: "→ Comparar países",
        },
        {
          title: "A Injustiça Climática",
          text: "O Catar emite 41 toneladas de CO2 por pessoa. A RDC emite 0,05. Uma diferença de 764x. Os países menos responsáveis pelas mudanças climáticas sofrerão suas piores consequências.",
          dataLabel: "Diferença de CO2: Catar vs RDC",
        },
        {
          title: "A Solução",
          text: "Um imposto de 2% sobre os 3.000 bilionários do mundo arrecada $313B/ano. Isso é suficiente para acabar com a pobreza extrema E financiar água, eletricidade e educação para todos. Com $50B de sobra.",
          dataLabel: "de um imposto de 2% sobre bilionários",
          linkLabel: "→ Ver a equação",
        },
        {
          title: "A Correção Combinada",
          text: "$422B/ano compra água potável + saúde + eletricidade + educação para cada ser humano vivo. Isso são 64 dias de gastos militares. 17,5%. A questão não é se podemos pagar por isso.",
          dataLabel: "= 64 dias de gastos militares",
          linkLabel: "→ Agir agora",
        },
      ],
    },
    es: {
      title: "La Máquina de la Desigualdad",
      duration: "5 min",
      steps: [
        {
          title: "La Brecha",
          text: "El 1% más rico posee más riqueza que el 50% más pobre. El dinero existe. El sistema lo redistribuye hacia arriba. Esto no es natural — está diseñado.",
          dataLabel: "riqueza de multimillonarios (USD)",
        },
        {
          title: "La Brecha Médica",
          text: "Noruega tiene 4,8 médicos por cada 1.000 habitantes. La República Centroafricana tiene 0,1. Una brecha de 48x. El mínimo de la OMS es 4,45. 186 de los 194 países están por debajo.",
          linkLabel: "→ Comparar países",
        },
        {
          title: "La Injusticia Climática",
          text: "Catar emite 41 toneladas de CO2 por persona. La RDC emite 0,05. Una brecha de 764x. Los países menos responsables del cambio climático sufrirán sus peores consecuencias.",
          dataLabel: "Brecha de CO2: Catar vs RDC",
        },
        {
          title: "La Solución",
          text: "Un impuesto del 2% sobre los 3.000 multimillonarios del mundo recauda $313B/año. Es suficiente para acabar con la pobreza extrema Y financiar agua, electricidad y educación para todos. Con $50B de sobra.",
          dataLabel: "de un impuesto del 2% a multimillonarios",
          linkLabel: "→ Ver la ecuación",
        },
        {
          title: "La Solución Combinada",
          text: "$422B/año compra agua segura + atención médica + electricidad + educación para cada ser humano vivo. Eso son 64 días de gasto militar. 17,5%. La pregunta no es si podemos permitirnoslo.",
          dataLabel: "= 64 días de gasto militar",
          linkLabel: "→ Tomar acción",
        },
      ],
    },
    fr: {
      title: "La Machine à Inégalités",
      duration: "5 min",
      steps: [
        {
          title: "L'Écart",
          text: "Les 1 % les plus riches possèdent plus de richesses que les 50 % les plus pauvres. L'argent existe. Le système le redistribue vers le haut. Ce n'est pas naturel — c'est conçu.",
          dataLabel: "richesse des milliardaires (USD)",
        },
        {
          title: "L'Écart Médical",
          text: "La Norvège a 4,8 médecins pour 1 000 habitants. La République centrafricaine a 0,1. Un écart de 48x. Le minimum de l'OMS est de 4,45. 186 des 194 pays sont en dessous.",
          linkLabel: "→ Comparer les pays",
        },
        {
          title: "L'Injustice Climatique",
          text: "Le Qatar émet 41 tonnes de CO2 par personne. La RDC émet 0,05. Un écart de 764x. Les pays les moins responsables du changement climatique en subiront les pires conséquences.",
          dataLabel: "Écart de CO2 : Qatar vs RDC",
        },
        {
          title: "La Solution",
          text: "Un impôt de 2 % sur les 3 000 milliardaires du monde rapporte 313 milliards $/an. Cela suffit à éradiquer l'extrême pauvreté ET à financer l'eau, l'électricité et l'éducation pour tous. Avec 50 milliards $ de reste.",
          dataLabel: "d'un impôt de 2 % sur les milliardaires",
          linkLabel: "→ Voir l'équation",
        },
        {
          title: "La Solution Combinée",
          text: "422 milliards $/an achètent eau potable + soins de santé + électricité + éducation pour chaque être humain vivant. C'est 64 jours de dépenses militaires. 17,5 %. La question n'est pas de savoir si nous pouvons nous le permettre.",
          dataLabel: "= 64 jours de dépenses militaires",
          linkLabel: "→ Passer à l'action",
        },
      ],
    },
    zh: {
      title: "不平等机器",
      duration: "5分钟",
      steps: [
        {
          title: "差距",
          text: "最富有的1%拥有的财富超过最贫穷的50%。钱是存在的。系统将其向上重新分配。这不是自然的——这是人为设计的。",
          dataLabel: "亿万富翁财富（美元）",
        },
        {
          title: "医生差距",
          text: "挪威每1000人有4.8名医生。中非共和国有0.1名。差距达48倍。世界卫生组织最低标准是4.45。194个国家中有186个低于此标准。",
          linkLabel: "→ 比较国家",
        },
        {
          title: "气候不公",
          text: "卡塔尔每人排放41吨二氧化碳。刚果民主共和国排放0.05吨。差距达764倍。对气候变化责任最小的国家将承受其最严重的后果。",
          dataLabel: "二氧化碳差距：卡塔尔 vs 刚果（金）",
        },
        {
          title: "解决方案",
          text: "对全球3000名亿万富翁征收2%的税可筹集3130亿美元/年。这足以消除极端贫困，并为所有人提供水、电力和教育。还剩余500亿美元。",
          dataLabel: "来自2%的亿万富翁税",
          linkLabel: "→ 查看等式",
        },
        {
          title: "综合方案",
          text: "4220亿美元/年可为每个活着的人购买安全用水+医疗保健+电力+教育。这是64天的军费开支。17.5%。问题不在于我们是否能负担得起。",
          dataLabel: "= 64天的军费开支",
          linkLabel: "→ 采取行动",
        },
      ],
    },
    ja: {
      title: "不平等マシン",
      duration: "5分",
      steps: [
        {
          title: "格差",
          text: "最も裕福な1%が、下位50%よりも多くの富を保有しています。お金は存在します。システムがそれを上層へ再配分しているのです。これは自然ではない——設計されているのです。",
          dataLabel: "億万長者の富（USD）",
        },
        {
          title: "医師格差",
          text: "ノルウェーは人口1000人あたり医師4.8人。中央アフリカ共和国は0.1人。48倍の格差です。WHO最低基準は4.45。194カ国中186カ国がそれを下回っています。",
          linkLabel: "→ 国を比較する",
        },
        {
          title: "気候不正義",
          text: "カタールは一人あたり41トンのCO2を排出します。DRCは0.05トン。764倍の格差です。気候変動への責任が最も少ない国が、その最悪の結果を被ることになります。",
          dataLabel: "CO2格差：カタール vs DRC",
        },
        {
          title: "解決策",
          text: "世界の3000人の億万長者への2%の税で年額3130億ドルが集まります。それは極度の貧困を終わらせ、全員に水、電力、教育を提供するのに十分です。500億ドルも余ります。",
          dataLabel: "億万長者2%税から",
          linkLabel: "→ 方程式を見る",
        },
        {
          title: "総合的解決策",
          text: "年額4220億ドルで、生きているすべての人に安全な水＋医療＋電力＋教育を提供できます。これは軍事費の64日分です。17.5%。問題はそれができるかどうかではありません。",
          dataLabel: "= 軍事費の64日分",
          linkLabel: "→ 行動する",
        },
      ],
    },
    ko: {
      title: "불평등 기계",
      duration: "5분",
      steps: [
        {
          title: "격차",
          text: "가장 부유한 1%가 하위 50%보다 더 많은 부를 보유하고 있습니다. 돈은 존재합니다. 시스템이 그것을 위로 재분배합니다. 이것은 자연스러운 것이 아닙니다 — 설계된 것입니다.",
          dataLabel: "억만장자 부 (USD)",
        },
        {
          title: "의사 격차",
          text: "노르웨이는 인구 1,000명당 의사 4.8명입니다. 중앙아프리카 공화국은 0.1명입니다. 48배의 격차입니다. WHO 최소 기준은 4.45입니다. 194개국 중 186개국이 이보다 낮습니다.",
          linkLabel: "→ 국가 비교",
        },
        {
          title: "기후 불의",
          text: "카타르는 1인당 41톤의 CO2를 배출합니다. DRC는 0.05톤입니다. 764배의 격차입니다. 기후 변화에 가장 적게 책임이 있는 국가들이 가장 심각한 결과를 겪게 될 것입니다.",
          dataLabel: "CO2 격차: 카타르 vs DRC",
        },
        {
          title: "해결책",
          text: "전 세계 3,000명의 억만장자에게 2%의 세금을 부과하면 연간 3130억 달러가 조달됩니다. 이는 극빈을 종식시키고 모든 사람에게 물, 전력, 교육을 자금 지원하기에 충분합니다. 500억 달러가 남습니다.",
          dataLabel: "억만장자 2% 세금에서",
          linkLabel: "→ 방정식 보기",
        },
        {
          title: "통합 해결책",
          text: "연간 4220억 달러로 살아있는 모든 인간에게 안전한 물 + 의료 + 전력 + 교육을 제공할 수 있습니다. 이는 군사비의 64일 분량입니다. 17.5%. 문제는 감당할 수 있느냐가 아닙니다.",
          dataLabel: "= 군사비 64일 분량",
          linkLabel: "→ 행동하기",
        },
      ],
    },
    hi: {
      title: "असमानता मशीन",
      duration: "5 मिनट",
      steps: [
        {
          title: "अंतर",
          text: "सबसे अमीर 1% लोगों के पास निचले 50% से अधिक धन है। पैसा मौजूद है। यह व्यवस्था इसे ऊपर की ओर पुनर्वितरित करती है। यह प्राकृतिक नहीं है — यह डिज़ाइन किया गया है।",
          dataLabel: "अरबपतियों का धन (USD)",
        },
        {
          title: "डॉक्टर अंतर",
          text: "नॉर्वे में 1,000 लोगों पर 4.8 डॉक्टर हैं। मध्य अफ़्रीकी गणराज्य में 0.1 हैं। 48 गुना का अंतर। WHO न्यूनतम 4.45 है। 194 देशों में से 186 इससे नीचे हैं।",
          linkLabel: "→ देशों की तुलना करें",
        },
        {
          title: "जलवायु अन्याय",
          text: "कतर प्रति व्यक्ति 41 टन CO2 उत्सर्जित करता है। DRC 0.05 उत्सर्जित करता है। 764 गुना का अंतर। जलवायु परिवर्तन के लिए सबसे कम जिम्मेदार देश इसके सबसे खराब परिणाम झेलेंगे।",
          dataLabel: "CO2 अंतर: कतर vs DRC",
        },
        {
          title: "समाधान",
          text: "दुनिया के 3,000 अरबपतियों पर 2% कर से $313B/वर्ष जुटते हैं। यह चरम गरीबी समाप्त करने और सभी के लिए पानी, बिजली और शिक्षा को वित्तपोषित करने के लिए पर्याप्त है। $50B शेष रहते हैं।",
          dataLabel: "2% अरबपति कर से",
          linkLabel: "→ समीकरण देखें",
        },
        {
          title: "संयुक्त समाधान",
          text: "$422B/वर्ष जीवित प्रत्येक मनुष्य के लिए सुरक्षित पानी + स्वास्थ्य सेवा + बिजली + शिक्षा खरीदता है। यह 64 दिनों का सैन्य खर्च है। 17.5%। सवाल यह नहीं कि हम इसका खर्च उठा सकते हैं या नहीं।",
          dataLabel: "= 64 दिनों का सैन्य खर्च",
          linkLabel: "→ कार्रवाई करें",
        },
      ],
    },
    ar: {
      title: "آلة عدم المساواة",
      duration: "5 دقيقة",
      steps: [
        {
          title: "الفجوة",
          text: "أغنى 1% يملكون ثروة أكبر من أفقر 50%. المال موجود. النظام يعيد توزيعه نحو الأعلى. هذا ليس طبيعياً — بل مصمم.",
          dataLabel: "ثروة المليارديرات (USD)",
        },
        {
          title: "فجوة الأطباء",
          text: "النرويج لديها 4.8 أطباء لكل 1,000 نسمة. جمهورية أفريقيا الوسطى لديها 0.1. فجوة بـ 48 ضعفاً. الحد الأدنى لمنظمة الصحة العالمية هو 4.45. 186 من أصل 194 دولة أقل من ذلك.",
          linkLabel: "→ مقارنة الدول",
        },
        {
          title: "الظلم المناخي",
          text: "قطر تنبعث 41 طناً من ثاني أكسيد الكربون للفرد. الكونغو الديمقراطية تنبعث 0.05. فجوة بـ 764 ضعفاً. الدول الأقل مسؤولية عن تغير المناخ ستعاني أسوأ عواقبه.",
          dataLabel: "فجوة CO2: قطر مقابل الكونغو الديمقراطية",
        },
        {
          title: "الحل",
          text: "ضريبة 2% على أغنى 3,000 ملياردير في العالم تدر 313 مليار $/سنوياً. هذا يكفي لإنهاء الفقر المدقع وتمويل المياه والكهرباء والتعليم للجميع. مع فائض 50 مليار $.",
          dataLabel: "من ضريبة 2% على المليارديرات",
          linkLabel: "→ عرض المعادلة",
        },
        {
          title: "الحل الشامل",
          text: "422 مليار $/سنوياً تشتري مياهاً آمنة + رعاية صحية + كهرباء + تعليم لكل إنسان حي. هذا يعادل 64 يوماً من الإنفاق العسكري. 17.5%. السؤال ليس ما إذا كنا نستطيع تحمل التكلفة.",
          dataLabel: "= 64 يوماً من الإنفاق العسكري",
          linkLabel: "→ اتخذ إجراءً",
        },
      ],
    },
    ru: {
      title: "Машина Неравенства",
      duration: "5 мин",
      steps: [
        {
          title: "Разрыв",
          text: "Самые богатые 1% владеют большим богатством, чем нижние 50%. Деньги есть. Система перераспределяет их наверх. Это не естественно — это задумано.",
          dataLabel: "богатство миллиардеров (USD)",
        },
        {
          title: "Разрыв Врачей",
          text: "В Норвегии 4,8 врача на 1 000 человек. В Центральноафриканской Республике — 0,1. Разрыв в 48 раз. Минимум ВОЗ — 4,45. 186 из 194 стран ниже этого уровня.",
          linkLabel: "→ Сравнить страны",
        },
        {
          title: "Климатическая Несправедливость",
          text: "Катар выбрасывает 41 тонну CO2 на человека. ДРК выбрасывает 0,05. Разрыв в 764 раза. Страны, наименее ответственные за изменение климата, пострадают от его худших последствий.",
          dataLabel: "Разрыв CO2: Катар vs ДРК",
        },
        {
          title: "Решение",
          text: "Налог 2% на 3 000 миллиардеров мира приносит 313 млрд $/год. Этого достаточно, чтобы покончить с крайней нищетой И финансировать воду, электричество и образование для всех. С остатком в 50 млрд $.",
          dataLabel: "от налога 2% на миллиардеров",
          linkLabel: "→ Смотреть уравнение",
        },
        {
          title: "Комплексное Решение",
          text: "422 млрд $/год покупают безопасную воду + здравоохранение + электричество + образование для каждого живого человека. Это 64 дня военных расходов. 17,5%. Вопрос не в том, можем ли мы это себе позволить.",
          dataLabel: "= 64 дня военных расходов",
          linkLabel: "→ Действовать",
        },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════
   * ACCOUNTABILITY — The Accountability Path
   * ═══════════════════════════════════════════════════════════════ */
  accountability: {
    en: {
      title: "The Accountability Path",
      duration: "4 min",
      steps: [
        {
          title: "The Documentation",
          text: "Hunger is weaponized. Aid convoys are blocked. Food storage is destroyed. These aren't accidents — they're tactics. And they're war crimes.",
          linkLabel: "→ Browse the registry",
        },
        {
          title: "The Evidence Chain",
          text: "Each dossier documents violations with primary source evidence: UN reports, satellite imagery, witness testimony. Quality-scored, peer-validated.",
          linkLabel: "→ See a dossier",
        },
        {
          title: "The International Bodies",
          text: "The ICC can prosecute war crimes. The ICJ adjudicates state responsibility. UN Special Rapporteurs receive individual communications. These mechanisms exist — they need evidence.",
          dataLabel: "dossiers documented",
        },
        {
          title: "The Action",
          text: "Every dossier has pre-filled submission templates for the ICC, UN, and public campaigns. The evidence is there. The channels are open. Use them.",
          linkLabel: "→ Generate accountability kit",
        },
      ],
    },
    pt: {
      title: "O Caminho da Responsabilização",
      duration: "4 min",
      steps: [
        {
          title: "A Documentação",
          text: "A fome é usada como arma. Convois de ajuda são bloqueados. Armazenamento de alimentos é destruído. Estes não são acidentes — são táticas. E são crimes de guerra.",
          linkLabel: "→ Navegar pelo registro",
        },
        {
          title: "A Cadeia de Evidências",
          text: "Cada dossiê documenta violações com evidências de fonte primária: relatórios da ONU, imagens de satélite, testemunhos. Com pontuação de qualidade, validados por pares.",
          linkLabel: "→ Ver um dossiê",
        },
        {
          title: "Os Organismos Internacionais",
          text: "O TPI pode processar crimes de guerra. A CIJ julga a responsabilidade estatal. Relatores Especiais da ONU recebem comunicações individuais. Esses mecanismos existem — eles precisam de evidências.",
          dataLabel: "dossiês documentados",
        },
        {
          title: "A Ação",
          text: "Cada dossiê tem modelos de submissão pré-preenchidos para o TPI, a ONU e campanhas públicas. As evidências estão lá. Os canais estão abertos. Use-os.",
          linkLabel: "→ Gerar kit de responsabilização",
        },
      ],
    },
    es: {
      title: "El Camino de la Rendición de Cuentas",
      duration: "4 min",
      steps: [
        {
          title: "La Documentación",
          text: "El hambre es utilizada como arma. Los convoyes de ayuda son bloqueados. Los almacenes de alimentos son destruidos. Estos no son accidentes — son tácticas. Y son crímenes de guerra.",
          linkLabel: "→ Explorar el registro",
        },
        {
          title: "La Cadena de Evidencia",
          text: "Cada dossier documenta violaciones con evidencia de fuente primaria: informes de la ONU, imágenes satelitales, testimonios de testigos. Calificados por calidad, validados por pares.",
          linkLabel: "→ Ver un dossier",
        },
        {
          title: "Los Organismos Internacionales",
          text: "La CPI puede procesar crímenes de guerra. La CIJ adjudica la responsabilidad estatal. Los Relatores Especiales de la ONU reciben comunicaciones individuales. Estos mecanismos existen — necesitan evidencia.",
          dataLabel: "dossiers documentados",
        },
        {
          title: "La Acción",
          text: "Cada dossier tiene plantillas de presentación precargadas para la CPI, la ONU y campañas públicas. La evidencia está ahí. Los canales están abiertos. Úsalos.",
          linkLabel: "→ Generar kit de rendición de cuentas",
        },
      ],
    },
    fr: {
      title: "La Voie de la Responsabilité",
      duration: "4 min",
      steps: [
        {
          title: "La Documentation",
          text: "La faim est utilisée comme arme. Les convois d'aide sont bloqués. Les entrepôts de nourriture sont détruits. Ce ne sont pas des accidents — ce sont des tactiques. Et ce sont des crimes de guerre.",
          linkLabel: "→ Parcourir le registre",
        },
        {
          title: "La Chaîne de Preuves",
          text: "Chaque dossier documente les violations avec des preuves de source primaire : rapports de l'ONU, imagerie satellitaire, témoignages. Notés en qualité, validés par les pairs.",
          linkLabel: "→ Voir un dossier",
        },
        {
          title: "Les Instances Internationales",
          text: "La CPI peut poursuivre les crimes de guerre. La CIJ statue sur la responsabilité des États. Les rapporteurs spéciaux de l'ONU reçoivent les communications individuelles. Ces mécanismes existent — ils ont besoin de preuves.",
          dataLabel: "dossiers documentés",
        },
        {
          title: "L'Action",
          text: "Chaque dossier dispose de modèles de soumission pré-remplis pour la CPI, l'ONU et les campagnes publiques. Les preuves sont là. Les canaux sont ouverts. Utilisez-les.",
          linkLabel: "→ Générer un kit de responsabilité",
        },
      ],
    },
    zh: {
      title: "问责之路",
      duration: "4分钟",
      steps: [
        {
          title: "记录",
          text: "饥饿被武器化。援助车队被封锁。粮食储存被摧毁。这些不是意外——它们是战术。它们是战争罪。",
          linkLabel: "→ 浏览登记册",
        },
        {
          title: "证据链",
          text: "每个档案都用一手来源证据记录违规行为：联合国报告、卫星图像、目击者证词。质量评分，同行验证。",
          linkLabel: "→ 查看档案",
        },
        {
          title: "国际机构",
          text: "国际刑事法院可以起诉战争罪。国际法院裁决国家责任。联合国特别报告员接收个人来文。这些机制存在——它们需要证据。",
          dataLabel: "已记录的档案",
        },
        {
          title: "行动",
          text: "每个档案都有预填的提交模板，面向国际刑事法院、联合国和公共运动。证据就在那里。渠道是开放的。使用它们。",
          linkLabel: "→ 生成问责工具包",
        },
      ],
    },
    ja: {
      title: "責任追及の道",
      duration: "4分",
      steps: [
        {
          title: "記録",
          text: "飢餓が武器として使われています。援助車列が封鎖されています。食糧備蓄が破壊されています。これらは事故ではありません——戦術です。そして戦争犯罪です。",
          linkLabel: "→ レジストリを見る",
        },
        {
          title: "証拠チェーン",
          text: "各ファイルは一次ソースの証拠で違反を記録しています：国連報告書、衛星画像、目撃者証言。品質採点済み、ピアレビュー済み。",
          linkLabel: "→ ファイルを見る",
        },
        {
          title: "国際機関",
          text: "ICCは戦争犯罪を起訴できます。ICJは国家責任を裁定します。国連特別報告者は個人からの通信を受け付けます。これらの仕組みは存在します——証拠が必要なのです。",
          dataLabel: "記録されたファイル",
        },
        {
          title: "行動",
          text: "各ファイルにはICC、国連、公開キャンペーン向けの事前入力された提出テンプレートがあります。証拠はそこにあります。窓口は開かれています。それらを使ってください。",
          linkLabel: "→ 責任追及キットを生成",
        },
      ],
    },
    ko: {
      title: "책임 추구의 길",
      duration: "4분",
      steps: [
        {
          title: "기록",
          text: "기아가 무기화되고 있습니다. 원호 수송대가 봉쇄됩니다. 식량 저장소가 파괴됩니다. 이것들은 사고가 아닙니다 — 전술입니다. 그리고 전쟁 범죄입니다.",
          linkLabel: "→ 레지스트리 탐색",
        },
        {
          title: "증거 체인",
          text: "각 파일은 일차 출처 증거로 위반 사항을 기록합니다: UN 보고서, 위성 이미지, 목격자 증언. 품질 점수 부여, 동료 검증 완료.",
          linkLabel: "→ 파일 보기",
        },
        {
          title: "국제 기구",
          text: "ICC는 전쟁 범죄를 기소할 수 있습니다. ICJ는 국가 책임을 재판합니다. UN 특별 보고관은 개인 통신을 접수합니다. 이러한 메커니즘은 존재합니다 — 증거가 필요합니다.",
          dataLabel: "기록된 파일",
        },
        {
          title: "행동",
          text: "각 파일에는 ICC, UN 및 공개 캠페인을 위한 사전 작성된 제출 템플릿이 있습니다. 증거는 그곳에 있습니다. 채널은 열려 있습니다. 그것들을 사용하세요.",
          linkLabel: "→ 책임 추구 키트 생성",
        },
      ],
    },
    hi: {
      title: "जवाबदेही का मार्ग",
      duration: "4 मिनट",
      steps: [
        {
          title: "दस्तावेज़ीकरण",
          text: "भुखमरी को हथियार बनाया जाता है। सहायता काफिलों को रोका जाता है। खाद्य भंडार को नष्ट किया जाता है। ये दुर्घटनाएं नहीं हैं — ये रणनीतियां हैं। और ये युद्ध अपराध हैं।",
          linkLabel: "→ रजिस्ट्री ब्राउज़ करें",
        },
        {
          title: "साक्ष्य श्रृंखला",
          text: "प्रत्येक फाइल प्राथमिक स्रोत साक्ष्य के साथ उल्लंघनों का दस्तावेज़ीकरण करती है: संयुक्त राष्ट्र रिपोर्टें, उपग्रह छवियां, गवाह गवाही। गुणवत्ता-स्कोर किए गए, सहकर्मी-सत्यापित।",
          linkLabel: "→ फाइल देखें",
        },
        {
          title: "अंतर्राष्ट्रीय निकाय",
          text: "ICC युद्ध अपराधों पर मुकदमा चला सकता है। ICJ राज्य की जिम्मेदारी का निर्णय करता है। संयुक्त राष्ट्र विशेष रिपोर्टर व्यक्तिगत संचार प्राप्त करते हैं। ये तंत्र मौजूद हैं — इन्हें साक्ष्य चाहिए।",
          dataLabel: "दस्तावेज़ित फाइलें",
        },
        {
          title: "कार्रवाई",
          text: "प्रत्येक फाइल में ICC, संयुक्त राष्ट्र और सार्वजनिक अभियानों के लिए पहले से भरे गए सबमिशन टेम्पलेट हैं। साक्ष्य वहां है। चैनल खुले हैं। उनका उपयोग करें।",
          linkLabel: "→ जवाबदेही किट तैयार करें",
        },
      ],
    },
    ar: {
      title: "مسار المساءلة",
      duration: "4 دقيقة",
      steps: [
        {
          title: "التوثيق",
          text: "الجوع يُستخدم كسلاح. قوافل المساعدات تُحاصر. مخازن الغذاء تُدمر. هذه ليست حوادث — بل تكتيكات. وهي جرائم حرب.",
          linkLabel: "→ تصفح السجل",
        },
        {
          title: "سلسلة الأدلة",
          text: "كل ملف يوثّق الانتهاكات بأدلة من المصادر الأولية: تقارير الأمم المتحدة، صور الأقمار الصناعية، شهادات الشهود. مقيّمة الجودة، ومتحقّق منها من قبل الأقران.",
          linkLabel: "→ عرض ملف",
        },
        {
          title: "الهيئات الدولية",
          text: "محكمة الجنائية الدولية يمكنها مقاضاة جرائم الحرب. محكمة العدل الدولية تفصل في مسؤولية الدول. المقررون الخاصون للأمم المتحدة يتلقون البلاغات الفردية. هذه الآليات موجودة — تحتاج إلى أدلة.",
          dataLabel: "ملفات موثّقة",
        },
        {
          title: "الإجراء",
          text: "كل ملف يحتوي على نماذج تقديم جاهزة لمحكمة الجنائية الدولية والأمم المتحدة والحملات العامة. الأدلة موجودة. القنوات مفتوحة. استخدمها.",
          linkLabel: "→ إنشاء حزمة المساءلة",
        },
      ],
    },
    ru: {
      title: "Путь Ответственности",
      duration: "4 мин",
      steps: [
        {
          title: "Документация",
          text: "Голод используется как оружие. Конвои с помощью блокируются. Хранилища продовольствия уничтожаются. Это не случайности — это тактика. И это военные преступления.",
          linkLabel: "→ Просмотреть реестр",
        },
        {
          title: "Цепочка Доказательств",
          text: "Каждое досье документирует нарушения с использованием первичных источников: отчёты ООН, спутниковые снимки, показания свидетелей. Оценка качества, проверка экспертами.",
          linkLabel: "→ Смотреть досье",
        },
        {
          title: "Международные Органы",
          text: "МУС может преследовать за военные преступления. МСС выносит решения о государственной ответственности. Специальные докладчики ООН принимают индивидуальные сообщения. Эти механизмы существуют — им нужны доказательства.",
          dataLabel: "досье задокументировано",
        },
        {
          title: "Действие",
          text: "У каждого досье есть предзаполненные шаблоны обращений для МУС, ООН и общественных кампаний. Доказательства на месте. Каналы открыты. Используйте их.",
          linkLabel: "→ Создать набор для ответственности",
        },
      ],
    },
  },
};

/** Translate a story by ID and language. */
export function ts(id: string, lang: Lang): StoryI18n {
  return STORY_I18N[id]?.[lang] ?? STORY_I18N[id]?.en ?? { title: id, duration: "", steps: [] };
}
