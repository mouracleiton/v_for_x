#!/usr/bin/env python3
"""
add_country_translations.py
============================

Adds translated country-name fields for 8 languages to the world backbone data:

    name_es  — Spanish
    name_fr  — French
    name_zh  — Chinese (Simplified)
    name_ja  — Japanese
    name_ko  — Korean
    name_hi  — Hindi
    name_ar  — Arabic
    name_ru  — Russian

Files updated (in place, preserving formatting):
    data/world_backbone.json        — countries[].name_XX
    data/world_backbone_geo.json    — features[].properties.name_XX

Every ISO3 code present in the data is covered by the TRANSLATIONS dictionary.
Any code missing from the dictionary is logged as a warning.

Usage:
    python3 scripts/add_country_translations.py
"""

from __future__ import annotations

import json
import os
import sys
from typing import Dict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKBONE_PATH = os.path.join(BASE_DIR, "data", "world_backbone.json")
GEO_PATH = os.path.join(BASE_DIR, "data", "world_backbone_geo.json")

LANG_FIELDS = ("name_es", "name_fr", "name_zh", "name_ja", "name_ko",
               "name_hi", "name_ar", "name_ru")
LANG_KEYS = ("es", "fr", "zh", "ja", "ko", "hi", "ar", "ru")

# ---------------------------------------------------------------------------
# Comprehensive translation dictionary for all 200 countries.
# Keys are ISO 3166-1 alpha-3 codes; values map each of the 8 languages.
# Official / standard short names are used in every language.
# ---------------------------------------------------------------------------
TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "AFG": {"es": "Afganistán", "fr": "Afghanistan", "zh": "阿富汗", "ja": "アフガニスタン", "ko": "아프가니스탄", "hi": "अफ़गानिस्तान", "ar": "أفغانستان", "ru": "Афганистан"},
    "ALB": {"es": "Albania", "fr": "Albanie", "zh": "阿尔巴尼亚", "ja": "アルバニア", "ko": "알바니아", "hi": "अल्बानिया", "ar": "ألبانيا", "ru": "Албания"},
    "DZA": {"es": "Argelia", "fr": "Algérie", "zh": "阿尔及利亚", "ja": "アルジェリア", "ko": "알제리", "hi": "अल्जीरिया", "ar": "الجزائر", "ru": "Алжир"},
    "AND": {"es": "Andorra", "fr": "Andorre", "zh": "安道尔", "ja": "アンドラ", "ko": "안도라", "hi": "अंडोरा", "ar": "أندورا", "ru": "Андорра"},
    "AGO": {"es": "Angola", "fr": "Angola", "zh": "安哥拉", "ja": "アンゴラ", "ko": "앙골라", "hi": "अंगोला", "ar": "أنغولا", "ru": "Ангола"},
    "ATG": {"es": "Antigua y Barbuda", "fr": "Antigua-et-Barbuda", "zh": "安提瓜和巴布达", "ja": "アンティグア・バーブーダ", "ko": "앤티가 바부다", "hi": "एंटिगुआ और बारबुडा", "ar": "أنتيغوا وبربودا", "ru": "Антигуа и Барбуда"},
    "ARG": {"es": "Argentina", "fr": "Argentine", "zh": "阿根廷", "ja": "アルゼンチン", "ko": "아르헨티나", "hi": "अर्जेंटीना", "ar": "الأرجنتين", "ru": "Аргентина"},
    "ARM": {"es": "Armenia", "fr": "Arménie", "zh": "亚美尼亚", "ja": "アルメニア", "ko": "아르메니아", "hi": "आर्मेनिया", "ar": "أرمينيا", "ru": "Армения"},
    "AUS": {"es": "Australia", "fr": "Australie", "zh": "澳大利亚", "ja": "オーストラリア", "ko": "오스트레일리아", "hi": "ऑस्ट्रेलिया", "ar": "أستراليا", "ru": "Австралия"},
    "AUT": {"es": "Austria", "fr": "Autriche", "zh": "奥地利", "ja": "オーストリア", "ko": "오스트리아", "hi": "ऑस्ट्रिया", "ar": "النمسا", "ru": "Австрия"},
    "AZE": {"es": "Azerbaiyán", "fr": "Azerbaïdjan", "zh": "阿塞拜疆", "ja": "アゼルバイジャン", "ko": "아제르바이잔", "hi": "अज़रबैजान", "ar": "أذربيجان", "ru": "Азербайджан"},
    "BHS": {"es": "Bahamas", "fr": "Bahamas", "zh": "巴哈马", "ja": "バハマ", "ko": "바하마", "hi": "बहामास", "ar": "باهاماس", "ru": "Багамские Острова"},
    "BHR": {"es": "Baréin", "fr": "Bahreïn", "zh": "巴林", "ja": "バーレーン", "ko": "바레인", "hi": "बहरीन", "ar": "البحرين", "ru": "Бахрейн"},
    "BGD": {"es": "Bangladés", "fr": "Bangladesh", "zh": "孟加拉国", "ja": "バングラデシュ", "ko": "방글라데시", "hi": "बांग्लादेश", "ar": "بنغلاديش", "ru": "Бангладеш"},
    "BRB": {"es": "Barbados", "fr": "Barbade", "zh": "巴巴多斯", "ja": "バルバドス", "ko": "바베이도스", "hi": "बारबाडोस", "ar": "باربادوس", "ru": "Барбадос"},
    "BLR": {"es": "Bielorrusia", "fr": "Biélorussie", "zh": "白俄罗斯", "ja": "ベラルーシ", "ko": "벨라루스", "hi": "बेलारूस", "ar": "بيلاروس", "ru": "Беларусь"},
    "BEL": {"es": "Bélgica", "fr": "Belgique", "zh": "比利时", "ja": "ベルギー", "ko": "벨기에", "hi": "बेल्जियम", "ar": "بلجيكا", "ru": "Бельгия"},
    "BLZ": {"es": "Belice", "fr": "Belize", "zh": "伯利兹", "ja": "ベリーズ", "ko": "벨리즈", "hi": "बेलीज़", "ar": "بليز", "ru": "Белиз"},
    "BEN": {"es": "Benín", "fr": "Bénin", "zh": "贝宁", "ja": "ベナン", "ko": "베냉", "hi": "बेनिन", "ar": "بنين", "ru": "Бенин"},
    "BTN": {"es": "Bután", "fr": "Bhoutan", "zh": "不丹", "ja": "ブータン", "ko": "부탄", "hi": "भूटान", "ar": "بوتان", "ru": "Бутан"},
    "BOL": {"es": "Bolivia", "fr": "Bolivie", "zh": "玻利维亚", "ja": "ボリビア", "ko": "볼리비아", "hi": "बोलीविया", "ar": "بوليفيا", "ru": "Боливия"},
    "BIH": {"es": "Bosnia y Herzegovina", "fr": "Bosnie-Herzégovine", "zh": "波斯尼亚和黑塞哥维那", "ja": "ボスニア・ヘルツェゴビナ", "ko": "보스니아 헤르체고비나", "hi": "बोस्निया और हर्ज़ेगोविना", "ar": "البوسنة والهرسك", "ru": "Босния и Герцеговина"},
    "BWA": {"es": "Botsuana", "fr": "Botswana", "zh": "博茨瓦纳", "ja": "ボツワナ", "ko": "보츠와나", "hi": "बोत्सवाना", "ar": "بوتسوانا", "ru": "Ботсвана"},
    "BRA": {"es": "Brasil", "fr": "Brésil", "zh": "巴西", "ja": "ブラジル", "ko": "브라질", "hi": "ब्राज़ील", "ar": "البرازيل", "ru": "Бразилия"},
    "BRN": {"es": "Brunéi", "fr": "Brunei", "zh": "文莱", "ja": "ブルネイ", "ko": "브루나이", "hi": "ब्रूनेई", "ar": "بروناي", "ru": "Бруней"},
    "BGR": {"es": "Bulgaria", "fr": "Bulgarie", "zh": "保加利亚", "ja": "ブルガリア", "ko": "불가리아", "hi": "बुल्गारिया", "ar": "بلغاريا", "ru": "Болгария"},
    "BFA": {"es": "Burkina Faso", "fr": "Burkina Faso", "zh": "布基纳法索", "ja": "ブルキナファソ", "ko": "부르키나파소", "hi": "बुर्किना फासो", "ar": "بوركينا فاسو", "ru": "Буркина-Фасо"},
    "BDI": {"es": "Burundi", "fr": "Burundi", "zh": "布隆迪", "ja": "ブルンジ", "ko": "부룬디", "hi": "बुरुंडी", "ar": "بوروندي", "ru": "Бурунди"},
    "CPV": {"es": "Cabo Verde", "fr": "Cap-Vert", "zh": "佛得角", "ja": "カーボベルデ", "ko": "카보베르데", "hi": "काबो वर्दे", "ar": "الرأس الأخضر", "ru": "Кабо-Верде"},
    "KHM": {"es": "Camboya", "fr": "Cambodge", "zh": "柬埔寨", "ja": "カンボジア", "ko": "캄보디아", "hi": "कंबोडिया", "ar": "كمبوديا", "ru": "Камбоджа"},
    "CMR": {"es": "Camerún", "fr": "Cameroun", "zh": "喀麦隆", "ja": "カメルーン", "ko": "카메룬", "hi": "कैमरून", "ar": "الكاميرون", "ru": "Камерун"},
    "CAN": {"es": "Canadá", "fr": "Canada", "zh": "加拿大", "ja": "カナダ", "ko": "캐나다", "hi": "कनाडा", "ar": "كندا", "ru": "Канада"},
    "CAF": {"es": "República Centroafricana", "fr": "République centrafricaine", "zh": "中非共和国", "ja": "中央アフリカ共和国", "ko": "중앙아프리카 공화국", "hi": "मध्य अफ़्रीकी गणराज्य", "ar": "جمهورية أفريقيا الوسطى", "ru": "ЦАР"},
    "TCD": {"es": "Chad", "fr": "Tchad", "zh": "乍得", "ja": "チャド", "ko": "차드", "hi": "चाड", "ar": "تشاد", "ru": "Чад"},
    "CHL": {"es": "Chile", "fr": "Chili", "zh": "智利", "ja": "チリ", "ko": "칠레", "hi": "चिली", "ar": "تشيلي", "ru": "Чили"},
    "CHN": {"es": "China", "fr": "Chine", "zh": "中国", "ja": "中国", "ko": "중국", "hi": "चीन", "ar": "الصين", "ru": "Китай"},
    "COL": {"es": "Colombia", "fr": "Colombie", "zh": "哥伦比亚", "ja": "コロンビア", "ko": "콜롬비아", "hi": "कोलंबिया", "ar": "كولومبيا", "ru": "Колумбия"},
    "COM": {"es": "Comoras", "fr": "Comores", "zh": "科摩罗", "ja": "コモロ", "ko": "코모로", "hi": "कोमोरोस", "ar": "جزر القمر", "ru": "Коморы"},
    "COG": {"es": "Congo", "fr": "Congo", "zh": "刚果（布）", "ja": "コンゴ共和国", "ko": "콩고 공화국", "hi": "कांगो गणराज्य", "ar": "جمهورية الكونغو", "ru": "Республика Конго"},
    "COD": {"es": "República Democrática del Congo", "fr": "République démocratique du Congo", "zh": "刚果（金）", "ja": "コンゴ民主共和国", "ko": "콩고 민주 공화국", "hi": "कांगो लोकतांत्रिक गणराज्य", "ar": "جمهورية الكونغو الديمقراطية", "ru": "ДР Конго"},
    "CRI": {"es": "Costa Rica", "fr": "Costa Rica", "zh": "哥斯达黎加", "ja": "コスタリカ", "ko": "코스타리카", "hi": "कोस्टा रिका", "ar": "كوستاريكا", "ru": "Коста-Рика"},
    "HRV": {"es": "Croacia", "fr": "Croatie", "zh": "克罗地亚", "ja": "クロアチア", "ko": "크로아티아", "hi": "क्रोएशिया", "ar": "كرواتيا", "ru": "Хорватия"},
    "CUB": {"es": "Cuba", "fr": "Cuba", "zh": "古巴", "ja": "キューバ", "ko": "쿠바", "hi": "क्यूबा", "ar": "كوبا", "ru": "Куба"},
    "CYP": {"es": "Chipre", "fr": "Chypre", "zh": "塞浦路斯", "ja": "キプロス", "ko": "키프로스", "hi": "साइप्रस", "ar": "قبرص", "ru": "Кипр"},
    "CZE": {"es": "Chequia", "fr": "Tchéquie", "zh": "捷克", "ja": "チェコ", "ko": "체코", "hi": "चेकिया", "ar": "تشيكيا", "ru": "Чехия"},
    "CIV": {"es": "Costa de Marfil", "fr": "Côte d'Ivoire", "zh": "科特迪瓦", "ja": "コートジボワール", "ko": "코트디부아르", "hi": "कोट डिव्वार", "ar": "ساحل العاج", "ru": "Кот-д’Ивуар"},
    "DNK": {"es": "Dinamarca", "fr": "Danemark", "zh": "丹麦", "ja": "デンマーク", "ko": "덴마크", "hi": "डेनमार्क", "ar": "الدنمارك", "ru": "Дания"},
    "DJI": {"es": "Yibuti", "fr": "Djibouti", "zh": "吉布提", "ja": "ジブチ", "ko": "지부티", "hi": "जिबूती", "ar": "جيبوتي", "ru": "Джибути"},
    "DMA": {"es": "Dominica", "fr": "Dominique", "zh": "多米尼克", "ja": "ドミニカ", "ko": "도미니카", "hi": "डोमिनिका", "ar": "دومينيكا", "ru": "Доминика"},
    "DOM": {"es": "República Dominicana", "fr": "République dominicaine", "zh": "多米尼加共和国", "ja": "ドミニカ共和国", "ko": "도미니카 공화국", "hi": "डोमिनिकन गणराज्य", "ar": "جمهورية الدومينيكان", "ru": "Доминиканская Республика"},
    "ECU": {"es": "Ecuador", "fr": "Équateur", "zh": "厄瓜多尔", "ja": "エクアドル", "ko": "에콰도르", "hi": "इक्वाडोर", "ar": "الإكوادور", "ru": "Эквадор"},
    "EGY": {"es": "Egipto", "fr": "Égypte", "zh": "埃及", "ja": "エジプト", "ko": "이집트", "hi": "मिस्र", "ar": "مصر", "ru": "Египет"},
    "SLV": {"es": "El Salvador", "fr": "El Salvador", "zh": "萨尔瓦多", "ja": "エルサルバドル", "ko": "엘살바도르", "hi": "अल सल्वाडोर", "ar": "السلفادور", "ru": "Сальвадор"},
    "GNQ": {"es": "Guinea Ecuatorial", "fr": "Guinée équatoriale", "zh": "赤道几内亚", "ja": "赤道ギニア", "ko": "적도 기니", "hi": "भूमध्यरेखीय गिनी", "ar": "غينيا الاستوائية", "ru": "Экваториальная Гвинея"},
    "ERI": {"es": "Eritrea", "fr": "Érythrée", "zh": "厄立特里亚", "ja": "エリトリア", "ko": "에리트레아", "hi": "इरित्रिया", "ar": "إريتريا", "ru": "Эритрея"},
    "EST": {"es": "Estonia", "fr": "Estonie", "zh": "爱沙尼亚", "ja": "エストニア", "ko": "에스토니아", "hi": "एस्टोनिया", "ar": "إستونيا", "ru": "Эстония"},
    "SWZ": {"es": "Esuatini", "fr": "Eswatini", "zh": "斯威士兰", "ja": "エスワティニ", "ko": "에스와티니", "hi": "एस्वातीनी", "ar": "إسواتيني", "ru": "Эсватини"},
    "ETH": {"es": "Etiopía", "fr": "Éthiopie", "zh": "埃塞俄比亚", "ja": "エチオピア", "ko": "에티오피아", "hi": "इथियोपिया", "ar": "إثيوبيا", "ru": "Эфиопия"},
    "FJI": {"es": "Fiyi", "fr": "Fidji", "zh": "斐济", "ja": "フィジー", "ko": "피지", "hi": "फ़िजी", "ar": "فيجي", "ru": "Фиджи"},
    "FIN": {"es": "Finlandia", "fr": "Finlande", "zh": "芬兰", "ja": "フィンランド", "ko": "핀란드", "hi": "फ़िनलैंड", "ar": "فنلندا", "ru": "Финляндия"},
    "FRA": {"es": "Francia", "fr": "France", "zh": "法国", "ja": "フランス", "ko": "프랑스", "hi": "फ़्रांस", "ar": "فرنسا", "ru": "Франция"},
    "GAB": {"es": "Gabón", "fr": "Gabon", "zh": "加蓬", "ja": "ガボン", "ko": "가봉", "hi": "गैबॉन", "ar": "الغابون", "ru": "Габон"},
    "GMB": {"es": "Gambia", "fr": "Gambie", "zh": "冈比亚", "ja": "ガンビア", "ko": "감비아", "hi": "गाम्बिया", "ar": "غامبيا", "ru": "Гамбия"},
    "GEO": {"es": "Georgia", "fr": "Géorgie", "zh": "格鲁吉亚", "ja": "ジョージア", "ko": "조지아", "hi": "जॉर्जिया", "ar": "جورجيا", "ru": "Грузия"},
    "DEU": {"es": "Alemania", "fr": "Allemagne", "zh": "德国", "ja": "ドイツ", "ko": "독일", "hi": "जर्मनी", "ar": "ألمانيا", "ru": "Германия"},
    "GHA": {"es": "Ghana", "fr": "Ghana", "zh": "加纳", "ja": "ガーナ", "ko": "가나", "hi": "घाना", "ar": "غانا", "ru": "Гана"},
    "GRC": {"es": "Grecia", "fr": "Grèce", "zh": "希腊", "ja": "ギリシャ", "ko": "그리스", "hi": "यूनान", "ar": "اليونان", "ru": "Греция"},
    "GRD": {"es": "Granada", "fr": "Grenade", "zh": "格林纳达", "ja": "グレナダ", "ko": "그레나다", "hi": "ग्रेनाडा", "ar": "غرينادا", "ru": "Гренада"},
    "GTM": {"es": "Guatemala", "fr": "Guatemala", "zh": "危地马拉", "ja": "グアテマラ", "ko": "과테말라", "hi": "ग्वाटेमाला", "ar": "غواتيمالا", "ru": "Гватемала"},
    "GIN": {"es": "Guinea", "fr": "Guinée", "zh": "几内亚", "ja": "ギニア", "ko": "기니", "hi": "गिनी", "ar": "غينيا", "ru": "Гвинея"},
    "GNB": {"es": "Guinea-Bisáu", "fr": "Guinée-Bissau", "zh": "几内亚比绍", "ja": "ギニアビサウ", "ko": "기니비사우", "hi": "गिनी-बिसाउ", "ar": "غينيا بيساو", "ru": "Гвинея-Бисау"},
    "GUY": {"es": "Guyana", "fr": "Guyana", "zh": "圭亚那", "ja": "ガイアナ", "ko": "가이아나", "hi": "गुयाना", "ar": "غيانا", "ru": "Гайана"},
    "HTI": {"es": "Haití", "fr": "Haïti", "zh": "海地", "ja": "ハイチ", "ko": "아이티", "hi": "हैती", "ar": "هايتي", "ru": "Гаити"},
    "HND": {"es": "Honduras", "fr": "Honduras", "zh": "洪都拉斯", "ja": "ホンジュラス", "ko": "온두라스", "hi": "होंडूरास", "ar": "هندوراس", "ru": "Гондурас"},
    "HUN": {"es": "Hungría", "fr": "Hongrie", "zh": "匈牙利", "ja": "ハンガリー", "ko": "헝가리", "hi": "हंगरी", "ar": "المجر", "ru": "Венгрия"},
    "ISL": {"es": "Islandia", "fr": "Islande", "zh": "冰岛", "ja": "アイスランド", "ko": "아이슬란드", "hi": "आइसलैंड", "ar": "آيسلندا", "ru": "Исландия"},
    "IND": {"es": "India", "fr": "Inde", "zh": "印度", "ja": "インド", "ko": "인도", "hi": "भारत", "ar": "الهند", "ru": "Индия"},
    "IDN": {"es": "Indonesia", "fr": "Indonésie", "zh": "印度尼西亚", "ja": "インドネシア", "ko": "인도네시아", "hi": "इंडोनेशिया", "ar": "إندونيسيا", "ru": "Индонезия"},
    "IRN": {"es": "Irán", "fr": "Iran", "zh": "伊朗", "ja": "イラン", "ko": "이란", "hi": "ईरान", "ar": "إيران", "ru": "Иран"},
    "IRQ": {"es": "Irak", "fr": "Irak", "zh": "伊拉克", "ja": "イラク", "ko": "이라크", "hi": "इराक", "ar": "العراق", "ru": "Ирак"},
    "IRL": {"es": "Irlanda", "fr": "Irlande", "zh": "爱尔兰", "ja": "アイルランド", "ko": "아일랜드", "hi": "आयरलैंड", "ar": "أيرلندا", "ru": "Ирландия"},
    "ISR": {"es": "Israel", "fr": "Israël", "zh": "以色列", "ja": "イスラエル", "ko": "이스라엘", "hi": "इज़राइल", "ar": "إسرائيل", "ru": "Израиль"},
    "ITA": {"es": "Italia", "fr": "Italie", "zh": "意大利", "ja": "イタリア", "ko": "이탈리아", "hi": "इटली", "ar": "إيطاليا", "ru": "Италия"},
    "JAM": {"es": "Jamaica", "fr": "Jamaïque", "zh": "牙买加", "ja": "ジャマイカ", "ko": "자메이카", "hi": "जमैका", "ar": "جامايكا", "ru": "Ямайка"},
    "JPN": {"es": "Japón", "fr": "Japon", "zh": "日本", "ja": "日本", "ko": "일본", "hi": "जापान", "ar": "اليابان", "ru": "Япония"},
    "JOR": {"es": "Jordania", "fr": "Jordanie", "zh": "约旦", "ja": "ヨルダン", "ko": "요르단", "hi": "जॉर्डन", "ar": "الأردن", "ru": "Иордания"},
    "KAZ": {"es": "Kazajistán", "fr": "Kazakhstan", "zh": "哈萨克斯坦", "ja": "カザフスタン", "ko": "카자흐스탄", "hi": "कज़ाखस्तान", "ar": "كازاخستان", "ru": "Казахстан"},
    "KEN": {"es": "Kenia", "fr": "Kenya", "zh": "肯尼亚", "ja": "ケニア", "ko": "케냐", "hi": "केन्या", "ar": "كينيا", "ru": "Кения"},
    "KIR": {"es": "Kiribati", "fr": "Kiribati", "zh": "基里巴斯", "ja": "キリバス", "ko": "키리바시", "hi": "किरिबाती", "ar": "كيريباتي", "ru": "Кирибати"},
    "KWT": {"es": "Kuwait", "fr": "Koweït", "zh": "科威特", "ja": "クウェート", "ko": "쿠웨이트", "hi": "कुवैत", "ar": "الكويت", "ru": "Кувейт"},
    "KGZ": {"es": "Kirguistán", "fr": "Kirghizistan", "zh": "吉尔吉斯斯坦", "ja": "キルギス", "ko": "키르기스스탄", "hi": "किर्गिज़स्तान", "ar": "قيرغيزستان", "ru": "Кыргызстан"},
    "LAO": {"es": "Laos", "fr": "Laos", "zh": "老挝", "ja": "ラオス", "ko": "라오스", "hi": "लाओस", "ar": "لاوس", "ru": "Лаос"},
    "LVA": {"es": "Letonia", "fr": "Lettonie", "zh": "拉脱维亚", "ja": "ラトビア", "ko": "라트비아", "hi": "लातविया", "ar": "لاتفيا", "ru": "Латвия"},
    "LBN": {"es": "Líbano", "fr": "Liban", "zh": "黎巴嫩", "ja": "レバノン", "ko": "레바논", "hi": "लेबनान", "ar": "لبنان", "ru": "Ливан"},
    "LSO": {"es": "Lesoto", "fr": "Lesotho", "zh": "莱索托", "ja": "レソト", "ko": "레소토", "hi": "लेसोथो", "ar": "ليسوتو", "ru": "Лесото"},
    "LBR": {"es": "Liberia", "fr": "Libéria", "zh": "利比里亚", "ja": "リベリア", "ko": "라이베리아", "hi": "लाइबेरिया", "ar": "ليبريا", "ru": "Либерия"},
    "LBY": {"es": "Libia", "fr": "Libye", "zh": "利比亚", "ja": "リビア", "ko": "리비아", "hi": "लीबिया", "ar": "ليبيا", "ru": "Ливия"},
    "LIE": {"es": "Liechtenstein", "fr": "Liechtenstein", "zh": "列支敦士登", "ja": "リヒテンシュタイン", "ko": "리히텐슈타인", "hi": "लिचेंस्टीन", "ar": "ليختنشتاين", "ru": "Лихтенштейн"},
    "LTU": {"es": "Lituania", "fr": "Lituanie", "zh": "立陶宛", "ja": "リトアニア", "ko": "리투아니아", "hi": "लिथुआनिया", "ar": "ليتوانيا", "ru": "Литва"},
    "LUX": {"es": "Luxemburgo", "fr": "Luxembourg", "zh": "卢森堡", "ja": "ルクセンブルク", "ko": "룩셈부르크", "hi": "लग्ज़मबर्ग", "ar": "لوكسمبورغ", "ru": "Люксембург"},
    "MDG": {"es": "Madagascar", "fr": "Madagascar", "zh": "马达加斯加", "ja": "マダガスカル", "ko": "마다가스카르", "hi": "मेडागास्कर", "ar": "مدغشقر", "ru": "Мадагаскар"},
    "MWI": {"es": "Malaui", "fr": "Malawi", "zh": "马拉维", "ja": "マラウイ", "ko": "말라위", "hi": "मलावी", "ar": "مالاوي", "ru": "Малави"},
    "MYS": {"es": "Malasia", "fr": "Malaisie", "zh": "马来西亚", "ja": "マレーシア", "ko": "말레이시아", "hi": "मलेशिया", "ar": "ماليزيا", "ru": "Малайзия"},
    "MDV": {"es": "Maldivas", "fr": "Maldives", "zh": "马尔代夫", "ja": "モルディブ", "ko": "몰디브", "hi": "मालदीव", "ar": "جزر المالديف", "ru": "Мальдивы"},
    "MLI": {"es": "Malí", "fr": "Mali", "zh": "马里", "ja": "マリ", "ko": "말리", "hi": "माली", "ar": "مالي", "ru": "Мали"},
    "MLT": {"es": "Malta", "fr": "Malte", "zh": "马耳他", "ja": "マルタ", "ko": "몰타", "hi": "माल्टा", "ar": "مالطا", "ru": "Мальта"},
    "MHL": {"es": "Islas Marshall", "fr": "Îles Marshall", "zh": "马绍尔群岛", "ja": "マーシャル諸島", "ko": "마셜 제도", "hi": "मार्शल द्वीपसमूह", "ar": "جزر مارشال", "ru": "Маршалловы Острова"},
    "MRT": {"es": "Mauritania", "fr": "Mauritanie", "zh": "毛里塔尼亚", "ja": "モーリタニア", "ko": "모리타니", "hi": "मॉरिटानिया", "ar": "موريتانيا", "ru": "Мавритания"},
    "MUS": {"es": "Mauricio", "fr": "Maurice", "zh": "毛里求斯", "ja": "モーリシャス", "ko": "모리셔스", "hi": "मॉरीशस", "ar": "موريشيوس", "ru": "Маврикий"},
    "MEX": {"es": "México", "fr": "Mexique", "zh": "墨西哥", "ja": "メキシコ", "ko": "멕시코", "hi": "मेक्सिको", "ar": "المكسيك", "ru": "Мексика"},
    "FSM": {"es": "Micronesia", "fr": "Micronésie", "zh": "密克罗尼西亚", "ja": "ミクロネシア連邦", "ko": "미크로네시아 연방", "hi": "माइक्रोनेशिया", "ar": "ميكرونيسيا", "ru": "Микронезия"},
    "MDA": {"es": "Moldavia", "fr": "Moldavie", "zh": "摩尔多瓦", "ja": "モルドバ", "ko": "몰도바", "hi": "मोल्दोवा", "ar": "مولدوفا", "ru": "Молдова"},
    "MCO": {"es": "Mónaco", "fr": "Monaco", "zh": "摩纳哥", "ja": "モナコ", "ko": "모나코", "hi": "मोनाको", "ar": "موناكو", "ru": "Монако"},
    "MNG": {"es": "Mongolia", "fr": "Mongolie", "zh": "蒙古", "ja": "モンゴル", "ko": "몽골", "hi": "मंगोलिया", "ar": "منغوليا", "ru": "Монголия"},
    "MNE": {"es": "Montenegro", "fr": "Monténégro", "zh": "黑山", "ja": "モンテネグロ", "ko": "몬테네그로", "hi": "मोंटेनेग्रो", "ar": "الجبل الأسود", "ru": "Черногория"},
    "MAR": {"es": "Marruecos", "fr": "Maroc", "zh": "摩洛哥", "ja": "モロッコ", "ko": "모로코", "hi": "मोरक्को", "ar": "المغرب", "ru": "Марокко"},
    "MOZ": {"es": "Mozambique", "fr": "Mozambique", "zh": "莫桑比克", "ja": "モザンビーク", "ko": "모잠비크", "hi": "मोज़ाम्बिक", "ar": "موزمبيق", "ru": "Мозамбик"},
    "MMR": {"es": "Birmania", "fr": "Myanmar", "zh": "缅甸", "ja": "ミャンマー", "ko": "미얀마", "hi": "म्यांमार", "ar": "ميانمار", "ru": "Мьянма"},
    "NAM": {"es": "Namibia", "fr": "Namibie", "zh": "纳米比亚", "ja": "ナミビア", "ko": "나미비아", "hi": "नामीबिया", "ar": "ناميبيا", "ru": "Намибия"},
    "NRU": {"es": "Nauru", "fr": "Nauru", "zh": "瑙鲁", "ja": "ナウル", "ko": "나우루", "hi": "नाउरू", "ar": "ناورو", "ru": "Науру"},
    "NPL": {"es": "Nepal", "fr": "Népal", "zh": "尼泊尔", "ja": "ネパール", "ko": "네팔", "hi": "नेपाल", "ar": "نيبال", "ru": "Непал"},
    "NLD": {"es": "Países Bajos", "fr": "Pays-Bas", "zh": "荷兰", "ja": "オランダ", "ko": "네덜란드", "hi": "नीदरलैंड", "ar": "هولندا", "ru": "Нидерланды"},
    "NZL": {"es": "Nueva Zelanda", "fr": "Nouvelle-Zélande", "zh": "新西兰", "ja": "ニュージーランド", "ko": "뉴질랜드", "hi": "न्यूज़ीलैंड", "ar": "نيوزيلندا", "ru": "Новая Зеландия"},
    "NIC": {"es": "Nicaragua", "fr": "Nicaragua", "zh": "尼加拉瓜", "ja": "ニカラグア", "ko": "니카라과", "hi": "निकारागुआ", "ar": "نيكاراغوا", "ru": "Никарагуа"},
    "NER": {"es": "Níger", "fr": "Niger", "zh": "尼日尔", "ja": "ニジェール", "ko": "니제르", "hi": "नाइजर", "ar": "النيجر", "ru": "Нигер"},
    "NGA": {"es": "Nigeria", "fr": "Nigeria", "zh": "尼日利亚", "ja": "ナイジェリア", "ko": "나이지리아", "hi": "नाइजीरिया", "ar": "نيجيريا", "ru": "Нигерия"},
    "MKD": {"es": "Macedonia del Norte", "fr": "Macédoine du Nord", "zh": "北马其顿", "ja": "北マケドニア", "ko": "북마케도니아", "hi": "उत्तरी मकदूनिया", "ar": "مقدونيا الشمالية", "ru": "Северная Македония"},
    "NOR": {"es": "Noruega", "fr": "Norvège", "zh": "挪威", "ja": "ノルウェー", "ko": "노르웨이", "hi": "नॉर्वे", "ar": "النرويج", "ru": "Норвегия"},
    "OMN": {"es": "Omán", "fr": "Oman", "zh": "阿曼", "ja": "オマーン", "ko": "오만", "hi": "ओमान", "ar": "عُمان", "ru": "Оман"},
    "PAK": {"es": "Pakistán", "fr": "Pakistan", "zh": "巴基斯坦", "ja": "パキスタン", "ko": "파키스탄", "hi": "पाकिस्तान", "ar": "باكستان", "ru": "Пакистан"},
    "PLW": {"es": "Palaos", "fr": "Palaos", "zh": "帕劳", "ja": "パラオ", "ko": "팔라우", "hi": "पलाऊ", "ar": "بالاو", "ru": "Палау"},
    "PAN": {"es": "Panamá", "fr": "Panama", "zh": "巴拿马", "ja": "パナマ", "ko": "파나마", "hi": "पनामा", "ar": "بنما", "ru": "Панама"},
    "PNG": {"es": "Papúa Nueva Guinea", "fr": "Papouasie-Nouvelle-Guinée", "zh": "巴布亚新几内亚", "ja": "パプアニューギニア", "ko": "파푸아뉴기니", "hi": "पापुआ न्यू गिनी", "ar": "بابوا غينيا الجديدة", "ru": "Папуа — Новая Гвинея"},
    "PRY": {"es": "Paraguay", "fr": "Paraguay", "zh": "巴拉圭", "ja": "パラグアイ", "ko": "파라과이", "hi": "पराग्वे", "ar": "باراغواي", "ru": "Парагвай"},
    "PER": {"es": "Perú", "fr": "Pérou", "zh": "秘鲁", "ja": "ペルー", "ko": "페루", "hi": "पेरू", "ar": "بيرو", "ru": "Перу"},
    "PHL": {"es": "Filipinas", "fr": "Philippines", "zh": "菲律宾", "ja": "フィリピン", "ko": "필리핀", "hi": "फ़िलीपींस", "ar": "الفلبين", "ru": "Филиппины"},
    "POL": {"es": "Polonia", "fr": "Pologne", "zh": "波兰", "ja": "ポーランド", "ko": "폴란드", "hi": "पोलैंड", "ar": "بولندا", "ru": "Польша"},
    "PRT": {"es": "Portugal", "fr": "Portugal", "zh": "葡萄牙", "ja": "ポルトガル", "ko": "포르투갈", "hi": "पुर्तगाल", "ar": "البرتغال", "ru": "Португалия"},
    "QAT": {"es": "Catar", "fr": "Qatar", "zh": "卡塔尔", "ja": "カタール", "ko": "카타르", "hi": "क़तर", "ar": "قطر", "ru": "Катар"},
    "ROU": {"es": "Rumania", "fr": "Roumanie", "zh": "罗马尼亚", "ja": "ルーマニア", "ko": "루마니아", "hi": "रोमानिया", "ar": "رومانيا", "ru": "Румыния"},
    "RUS": {"es": "Rusia", "fr": "Russie", "zh": "俄罗斯", "ja": "ロシア", "ko": "러시아", "hi": "रूस", "ar": "روسيا", "ru": "Россия"},
    "RWA": {"es": "Ruanda", "fr": "Rwanda", "zh": "卢旺达", "ja": "ルワンダ", "ko": "르완다", "hi": "रवांडा", "ar": "رواندا", "ru": "Руанда"},
    "KNA": {"es": "San Cristóbal y Nieves", "fr": "Saint-Christophe-et-Niévès", "zh": "圣基茨和尼维斯", "ja": "セントクリストファー・ネーヴィス", "ko": "세인트키츠 네비스", "hi": "सेंट किट्स और नेविस", "ar": "سانت كيتس ونيفيس", "ru": "Сент-Китс и Невис"},
    "LCA": {"es": "Santa Lucía", "fr": "Sainte-Lucie", "zh": "圣卢西亚", "ja": "セントルシア", "ko": "세인트루시아", "hi": "सेंट लूसिया", "ar": "سانت لوسيا", "ru": "Сент-Люсия"},
    "VCT": {"es": "San Vicente y las Granadinas", "fr": "Saint-Vincent-et-les-Grenadines", "zh": "圣文森特和格林纳丁斯", "ja": "セントビンセント・グレナディーン", "ko": "세인트빈센트 그레나딘", "hi": "सेंट विंसेंट और ग्रेनाडाइंस", "ar": "سانت فينسنت وجزر غرينادين", "ru": "Сент-Винсент и Гренадины"},
    "WSM": {"es": "Samoa", "fr": "Samoa", "zh": "萨摩亚", "ja": "サモア", "ko": "사모아", "hi": "समोआ", "ar": "ساموا", "ru": "Самоа"},
    "SMR": {"es": "San Marino", "fr": "Saint-Marin", "zh": "圣马力诺", "ja": "サンマリノ", "ko": "산마리노", "hi": "सैन मरीनो", "ar": "سان مارينو", "ru": "Сан-Марино"},
    "STP": {"es": "Santo Tomé y Príncipe", "fr": "Sao Tomé-et-Principe", "zh": "圣多美和普林西比", "ja": "サントメ・プリンシペ", "ko": "상투메 프린시페", "hi": "साओ तोमे और प्रिंसिपे", "ar": "ساو تومي وبرينسيبي", "ru": "Сан-Томе и Принсипи"},
    "SAU": {"es": "Arabia Saudí", "fr": "Arabie saoudite", "zh": "沙特阿拉伯", "ja": "サウジアラビア", "ko": "사우디아라비아", "hi": "सऊदी अरब", "ar": "السعودية", "ru": "Саудовская Аравия"},
    "SEN": {"es": "Senegal", "fr": "Sénégal", "zh": "塞内加尔", "ja": "セネガル", "ko": "세네갈", "hi": "सेनेगल", "ar": "السنغال", "ru": "Сенегал"},
    "SRB": {"es": "Serbia", "fr": "Serbie", "zh": "塞尔维亚", "ja": "セルビア", "ko": "세르비아", "hi": "सर्बिया", "ar": "صربيا", "ru": "Сербия"},
    "SYC": {"es": "Seychelles", "fr": "Seychelles", "zh": "塞舌尔", "ja": "セーシェル", "ko": "세이셸", "hi": "सेशेल्स", "ar": "سيشل", "ru": "Сейшельские Острова"},
    "SLE": {"es": "Sierra Leona", "fr": "Sierra Leone", "zh": "塞拉利昂", "ja": "シエラレオネ", "ko": "시에라리온", "hi": "सिएरा लियोन", "ar": "سيراليون", "ru": "Сьерра-Леоне"},
    "SGP": {"es": "Singapur", "fr": "Singapour", "zh": "新加坡", "ja": "シンガポール", "ko": "싱가포르", "hi": "सिंगापुर", "ar": "سنغافورة", "ru": "Сингапур"},
    "SVK": {"es": "Eslovaquia", "fr": "Slovaquie", "zh": "斯洛伐克", "ja": "スロバキア", "ko": "슬로바키아", "hi": "स्लोवाकिया", "ar": "سلوفاكيا", "ru": "Словакия"},
    "SVN": {"es": "Eslovenia", "fr": "Slovénie", "zh": "斯洛文尼亚", "ja": "スロベニア", "ko": "슬로베니아", "hi": "स्लोवेनिया", "ar": "سلوفينيا", "ru": "Словения"},
    "SLB": {"es": "Islas Salomón", "fr": "Îles Salomon", "zh": "所罗门群岛", "ja": "ソロモン諸島", "ko": "솔로몬 제도", "hi": "सोलोमन द्वीपसमूह", "ar": "جزر سليمان", "ru": "Соломоновы Острова"},
    "SOM": {"es": "Somalia", "fr": "Somalie", "zh": "索马里", "ja": "ソマリア", "ko": "소말리아", "hi": "सोमालिया", "ar": "الصومال", "ru": "Сомали"},
    "ZAF": {"es": "Sudáfrica", "fr": "Afrique du Sud", "zh": "南非", "ja": "南アフリカ", "ko": "남아프리카 공화국", "hi": "दक्षिण अफ़्रीका", "ar": "جنوب أفريقيا", "ru": "ЮАР"},
    "SSD": {"es": "Sudán del Sur", "fr": "Soudan du Sud", "zh": "南苏丹", "ja": "南スーダン", "ko": "남수단", "hi": "दक्षिण सूडान", "ar": "جنوب السودان", "ru": "Южный Судан"},
    "ESP": {"es": "España", "fr": "Espagne", "zh": "西班牙", "ja": "スペイン", "ko": "스페인", "hi": "स्पेन", "ar": "إسبانيا", "ru": "Испания"},
    "LKA": {"es": "Sri Lanka", "fr": "Sri Lanka", "zh": "斯里兰卡", "ja": "スリランカ", "ko": "스리랑카", "hi": "श्री लंका", "ar": "سريلانكا", "ru": "Шри-Ланка"},
    "SDN": {"es": "Sudán", "fr": "Soudan", "zh": "苏丹", "ja": "スーダン", "ko": "수단", "hi": "सूडान", "ar": "السودان", "ru": "Судан"},
    "SUR": {"es": "Surinam", "fr": "Suriname", "zh": "苏里南", "ja": "スリナム", "ko": "수리남", "hi": "सूरीनाम", "ar": "سورينام", "ru": "Суринам"},
    "SWE": {"es": "Suecia", "fr": "Suède", "zh": "瑞典", "ja": "スウェーデン", "ko": "스웨덴", "hi": "स्वीडन", "ar": "السويد", "ru": "Швеция"},
    "CHE": {"es": "Suiza", "fr": "Suisse", "zh": "瑞士", "ja": "スイス", "ko": "스위스", "hi": "स्विट्ज़रलैंड", "ar": "سويسرا", "ru": "Швейцария"},
    "SYR": {"es": "Siria", "fr": "Syrie", "zh": "叙利亚", "ja": "シリア", "ko": "시리아", "hi": "सीरिया", "ar": "سوريا", "ru": "Сирия"},
    "TJK": {"es": "Tayikistán", "fr": "Tadjikistan", "zh": "塔吉克斯坦", "ja": "タジキスタン", "ko": "타지키스탄", "hi": "ताजिकिस्तान", "ar": "طاجيكستان", "ru": "Таджикистан"},
    "THA": {"es": "Tailandia", "fr": "Thaïlande", "zh": "泰国", "ja": "タイ", "ko": "태국", "hi": "थाईलैंड", "ar": "تايلاند", "ru": "Таиланд"},
    "TLS": {"es": "Timor-Leste", "fr": "Timor oriental", "zh": "东帝汶", "ja": "東ティモール", "ko": "동티모르", "hi": "तिमोर-लेस्ते", "ar": "تيمور الشرقية", "ru": "Восточный Тимор"},
    "TGO": {"es": "Togo", "fr": "Togo", "zh": "多哥", "ja": "トーゴ", "ko": "토고", "hi": "टोगो", "ar": "توغو", "ru": "Того"},
    "TON": {"es": "Tonga", "fr": "Tonga", "zh": "汤加", "ja": "トンガ", "ko": "통가", "hi": "टोंगा", "ar": "تونغا", "ru": "Тонга"},
    "TTO": {"es": "Trinidad y Tobago", "fr": "Trinité-et-Tobago", "zh": "特立尼达和多巴哥", "ja": "トリニダード・トバゴ", "ko": "트리니다드 토바고", "hi": "त्रिनिदाद और टोबैगो", "ar": "ترينيداد وتوباغو", "ru": "Тринидад и Тобаго"},
    "TUN": {"es": "Túnez", "fr": "Tunisie", "zh": "突尼斯", "ja": "チュニジア", "ko": "튀니지", "hi": "ट्यूनीशिया", "ar": "تونس", "ru": "Тунис"},
    "TUR": {"es": "Turquía", "fr": "Turquie", "zh": "土耳其", "ja": "トルコ", "ko": "튀르키예", "hi": "तुर्किये", "ar": "تركيا", "ru": "Турция"},
    "TKM": {"es": "Turkmenistán", "fr": "Turkménistan", "zh": "土库曼斯坦", "ja": "トルクメニスタン", "ko": "투르크메니스탄", "hi": "तुर्कमेनिस्तान", "ar": "تركمانستان", "ru": "Туркменистан"},
    "TUV": {"es": "Tuvalu", "fr": "Tuvalu", "zh": "图瓦卢", "ja": "ツバル", "ko": "투발루", "hi": "तुवालु", "ar": "توفالو", "ru": "Тувалу"},
    "UGA": {"es": "Uganda", "fr": "Ouganda", "zh": "乌干达", "ja": "ウガンダ", "ko": "우간다", "hi": "युगांडा", "ar": "أوغندا", "ru": "Уганда"},
    "UKR": {"es": "Ucrania", "fr": "Ukraine", "zh": "乌克兰", "ja": "ウクライナ", "ko": "우크라이나", "hi": "यूक्रेन", "ar": "أوكرانيا", "ru": "Украина"},
    "ARE": {"es": "Emiratos Árabes Unidos", "fr": "Émirats arabes unis", "zh": "阿联酋", "ja": "アラブ首長国連邦", "ko": "아랍에미리트", "hi": "संयुक्त अरब अमीरात", "ar": "الإمارات العربية المتحدة", "ru": "ОАЭ"},
    "GBR": {"es": "Reino Unido", "fr": "Royaume-Uni", "zh": "英国", "ja": "イギリス", "ko": "영국", "hi": "यूनाइटेड किंगडम", "ar": "المملكة المتحدة", "ru": "Великобритания"},
    "TZA": {"es": "Tanzania", "fr": "Tanzanie", "zh": "坦桑尼亚", "ja": "タンザニア", "ko": "탄자니아", "hi": "तंज़ानिया", "ar": "تنزانيا", "ru": "Танзания"},
    "USA": {"es": "Estados Unidos", "fr": "États-Unis", "zh": "美国", "ja": "アメリカ", "ko": "미국", "hi": "संयुक्त राज्य अमेरिका", "ar": "الولايات المتحدة", "ru": "США"},
    "URY": {"es": "Uruguay", "fr": "Uruguay", "zh": "乌拉圭", "ja": "ウルグアイ", "ko": "우루과이", "hi": "उरुग्वे", "ar": "الأوروغواي", "ru": "Уругвай"},
    "UZB": {"es": "Uzbekistán", "fr": "Ouzbékistan", "zh": "乌兹别克斯坦", "ja": "ウズベキスタン", "ko": "우즈베키스탄", "hi": "उज़्बेकिस्तान", "ar": "أوزبكستان", "ru": "Узбекистан"},
    "VUT": {"es": "Vanuatu", "fr": "Vanuatu", "zh": "瓦努阿图", "ja": "バヌアツ", "ko": "바누아투", "hi": "वनुआतु", "ar": "فانواتو", "ru": "Вануату"},
    "VEN": {"es": "Venezuela", "fr": "Venezuela", "zh": "委内瑞拉", "ja": "ベネズエラ", "ko": "베네수엘라", "hi": "वेनेज़ुएला", "ar": "فنزويلا", "ru": "Венесуэла"},
    "VNM": {"es": "Vietnam", "fr": "Viêt Nam", "zh": "越南", "ja": "ベトナム", "ko": "베트남", "hi": "वियतनाम", "ar": "فيتنام", "ru": "Вьетнам"},
    "YEM": {"es": "Yemen", "fr": "Yémen", "zh": "也门", "ja": "イエメン", "ko": "예멘", "hi": "यमन", "ar": "اليمن", "ru": "Йемен"},
    "ZMB": {"es": "Zambia", "fr": "Zambie", "zh": "赞比亚", "ja": "ザンビア", "ko": "잠비아", "hi": "ज़ाम्बिया", "ar": "زامبيا", "ru": "Замбия"},
    "ZWE": {"es": "Zimbabue", "fr": "Zimbabwe", "zh": "津巴布韦", "ja": "ジンバブエ", "ko": "짐바브웨", "hi": "ज़िम्बाब्वे", "ar": "زيمبابوي", "ru": "Зимбабве"},
    "PRK": {"es": "Corea del Norte", "fr": "Corée du Nord", "zh": "朝鲜", "ja": "北朝鮮", "ko": "조선민주주의인민공화국", "hi": "उत्तर कोरिया", "ar": "كوريا الشمالية", "ru": "КНДР"},
    "KOR": {"es": "Corea del Sur", "fr": "Corée du Sud", "zh": "韩国", "ja": "韓国", "ko": "대한민국", "hi": "दक्षिण कोरिया", "ar": "كوريا الجنوبية", "ru": "Республика Корея"},
    "PSE": {"es": "Palestina", "fr": "Palestine", "zh": "巴勒斯坦", "ja": "パレスチナ", "ko": "팔레스타인", "hi": "फ़िलिस्तीन", "ar": "فلسطين", "ru": "Палестина"},
    "VAT": {"es": "Ciudad del Vaticano", "fr": "Vatican", "zh": "梵蒂冈", "ja": "バチカン", "ko": "바티칸 시국", "hi": "वेटिकन सिटी", "ar": "الفاتيكان", "ru": "Ватикан"},
    "COK": {"es": "Islas Cook", "fr": "Îles Cook", "zh": "库克群岛", "ja": "クック諸島", "ko": "쿡 제도", "hi": "कुक द्वीपसमूह", "ar": "جزر كوك", "ru": "Острова Кука"},
    "NIU": {"es": "Niue", "fr": "Niue", "zh": "纽埃", "ja": "ニウエ", "ko": "니우에", "hi": "नियुए", "ar": "نييوي", "ru": "Ниуэ"},
    "XKX": {"es": "Kosovo", "fr": "Kosovo", "zh": "科索沃", "ja": "コソボ", "ko": "코소보", "hi": "कोसोवो", "ar": "كوسوفو", "ru": "Косово"},
    "TWN": {"es": "Taiwán", "fr": "Taïwan", "zh": "台湾", "ja": "台湾", "ko": "대만", "hi": "ताइवान", "ar": "تايوان", "ru": "Тайвань"},
    "ESH": {"es": "Sahara Occidental", "fr": "Sahara occidental", "zh": "西撒哈拉", "ja": "西サハラ", "ko": "서사하라", "hi": "पश्चिमी सहारा", "ar": "الصحراء الغربية", "ru": "Западная Сахара"},
}


def _insert_translations(record: dict, iso3: str) -> int:
    """
    Insert the 8 translation fields into *record* right after 'name_pt'
    (or 'name_en' if 'name_pt' is absent).  Returns 1 if updated, else 0.
    """
    entry = TRANSLATIONS.get(iso3)
    if entry is None:
        return 0

    # Build a fresh, ordered copy so the new fields sit next to the names.
    new_record: "dict[str, object]" = {}
    inserted = False
    for key, value in record.items():
        new_record[key] = value
        if not inserted and key in ("name_pt", "name_en"):
            for field, lang in zip(LANG_FIELDS, LANG_KEYS):
                new_record[field] = entry[lang]
            inserted = True

    # Fallback: if neither name_pt nor name_en existed, append at the end.
    if not inserted:
        for field, lang in zip(LANG_FIELDS, LANG_KEYS):
            new_record[field] = entry[lang]

    record.clear()
    record.update(new_record)
    return 1


def process_backbone(path: str) -> tuple[int, int]:
    """Return (updated_count, missing_count) for the flat backbone file."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    updated = 0
    missing = 0
    for country in data.get("countries", []):
        iso3 = country.get("iso3")
        if iso3 not in TRANSLATIONS:
            missing += 1
            print(f"  WARNING: iso3 '{iso3}' not found in TRANSLATIONS — skipped")
            continue
        updated += _insert_translations(country, iso3)

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    return updated, missing


def process_geo(path: str) -> tuple[int, int]:
    """Return (updated_count, missing_count) for the GeoJSON file."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    updated = 0
    missing = 0
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        iso3 = props.get("iso3")
        if iso3 not in TRANSLATIONS:
            missing += 1
            print(f"  WARNING: iso3 '{iso3}' not found in TRANSLATIONS — skipped")
            continue
        updated += _insert_translations(props, iso3)

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    return updated, missing


def main() -> int:
    print("=" * 70)
    print("add_country_translations.py")
    print(f"  Languages: {', '.join(LANG_FIELDS)}")
    print(f"  Dictionary entries: {len(TRANSLATIONS)}")
    print("=" * 70)

    errors = 0

    # --- world_backbone.json ---
    if os.path.exists(BACKBONE_PATH):
        print(f"\nProcessing {BACKBONE_PATH} ...")
        upd, miss = process_backbone(BACKBONE_PATH)
        print(f"  ✓ Countries updated: {upd}")
        if miss:
            print(f"  ⚠ Countries missing translation: {miss}")
            errors += miss
    else:
        print(f"\n  ✗ File not found: {BACKBONE_PATH}")
        errors += 1

    # --- world_backbone_geo.json ---
    if os.path.exists(GEO_PATH):
        print(f"\nProcessing {GEO_PATH} ...")
        upd, miss = process_geo(GEO_PATH)
        print(f"  ✓ Features updated: {upd}")
        if miss:
            print(f"  ⚠ Features missing translation: {miss}")
            errors += miss
    else:
        print(f"\n  ✗ File not found: {GEO_PATH}")
        errors += 1

    print("\n" + "=" * 70)
    if errors:
        print(f"Completed with {errors} warning(s).")
    else:
        print("All countries translated successfully — no missing codes.")
    print("=" * 70)
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
