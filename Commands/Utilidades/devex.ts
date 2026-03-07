import 'dotenv/config';
import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    MessageFlags,
} from 'discord.js';


const ExchangeCache: Map<string, { rate: number, timestamp: number }> = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 1 Dia

const Translations: Record<string, Record<string, string>> = {
    id: {
        exchangeSelected: 'Pertukaran yang Dipilih:',
        enteredValue: 'Nilai yang Dimasukkan:',
        result: 'Hasil:',
        errorTitle: 'Kesalahan Konversi ❌',
        errorDescription: 'Tidak dapat mengambil nilai tukar. Silakan coba lagi nanti.',
        oldConversion: 'Konversi Lama',
        fxFee: 'FX Fee',
        tax: 'Pajak',
        enabled: 'Diaktifkan',
        devExCalculator: 'Kalkulator DevEx Roblox',
    },
    da: {
        exchangeSelected: 'Valuta valgt:',
        enteredValue: 'Indtastet værdi:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfejl ❌',
        errorDescription: 'Kunne ikke hente valutakurs. Prøv igen senere.',
        oldConversion: 'Gammel Konvertering',
        fxFee: 'FX Fee',
        tax: 'Skat',
        enabled: 'Aktiveret',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    de: {
        exchangeSelected: 'Ausgewählter Wechselkurs:',
        enteredValue: 'Eingegebener Wert:',
        result: 'Ergebnis:',
        errorTitle: 'Umrechnungsfehler ❌',
        errorDescription: 'Wechselkurs konnte nicht abgerufen werden. Bitte versuchen Sie es später erneut.',
        oldConversion: 'Alte Konversion',
        fxFee: 'FX Gebühr',
        tax: 'Gebühr',
        enabled: 'Aktiviert',
        devExCalculator: 'Roblox DevEx Rechner',
    },
    'en-GB': {
        exchangeSelected: 'Exchange Selected:',
        enteredValue: 'Entered Value:',
        result: 'Result:',
        errorTitle: 'Conversion Error ❌',
        errorDescription: 'Unable to fetch exchange rate. Please try again later.',
        oldConversion: 'Old Conversion',
        fxFee: 'FX Fee',
        tax: 'Tax',
        enabled: 'Enabled',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    'en-US': {
        exchangeSelected: 'Exchange Selected:',
        enteredValue: 'Entered Value:',
        result: 'Result:',
        errorTitle: 'Conversion Error ❌',
        errorDescription: 'Unable to fetch exchange rate. Please try again later.',
        oldConversion: 'Old Conversion',
        fxFee: 'FX Fee',
        tax: 'Tax',
        enabled: 'Enabled',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    'es-ES': {
        exchangeSelected: 'Cambio Seleccionado:',
        enteredValue: 'Valor Ingresado:',
        result: 'Resultado:',
        errorTitle: 'Error de Conversión ❌',
        errorDescription: 'No se pudo obtener la tasa de cambio. Por favor, inténtelo de nuevo más tarde.',
        oldConversion: 'Conversión Antigua',
        fxFee: 'FX Fee',
        tax: 'Tarifa',
        enabled: 'Activada',
        devExCalculator: 'Calculadora DevEx Roblox',
    },
    'es-419': {
        exchangeSelected: 'Cambio Seleccionado:',
        enteredValue: 'Valor Ingresado:',
        result: 'Resultado:',
        errorTitle: 'Error de Conversión ❌',
        errorDescription: 'No se pudo obtener la tasa de cambio. Por favor, inténtelo de nuevo más tarde.',
        oldConversion: 'Conversión Antigua',
        fxFee: 'FX Fee',
        tax: 'Tarifa',
        enabled: 'Activada',
        devExCalculator: 'Calculadora DevEx Roblox',
    },
    fr: {
        exchangeSelected: 'Échange Sélectionné:',
        enteredValue: 'Valeur Entrée:',
        result: 'Résultat:',
        errorTitle: 'Erreur de Conversion ❌',
        errorDescription: 'Impossible de récupérer le taux de change. Veuillez réessayer plus tard.',
        oldConversion: 'Ancienne Conversion',
        fxFee: 'FX Fee',
        tax: 'Taxe',
        enabled: 'Activé',
        devExCalculator: 'Calculatrice DevEx Roblox',
    },
    hr: {
        exchangeSelected: 'Odabrana Razmjena:',
        enteredValue: 'Unesena Vrijednost:',
        result: 'Rezultat:',
        errorTitle: 'Greška u Konverziji ❌',
        errorDescription: 'Nije moguće dohvatiti tečaj. Pokušajte ponovo kasnije.',
        oldConversion: 'Stara Konverzija',
        fxFee: 'FX Fee',
        tax: 'Porez',
        enabled: 'Omogućeno',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    it: {
        exchangeSelected: 'Cambio Selezionato:',
        enteredValue: 'Valore Inserito:',
        result: 'Risultato:',
        errorTitle: 'Errore di Conversione ❌',
        errorDescription: 'Impossibile recuperare il tasso di cambio. Per favore riprova più tardi.',
        oldConversion: 'Conversione Vecchia',
        fxFee: 'FX Fee',
        tax: 'Tassa',
        enabled: 'Attivata',
        devExCalculator: 'Calcolatrice DevEx Roblox',
    },
    lt: {
        exchangeSelected: 'Pasirinktas Valiutų Kursas:',
        enteredValue: 'Įvesta Vertė:',
        result: 'Rezultatas:',
        errorTitle: 'Konvertavimo Klaida ❌',
        errorDescription: 'Nepavyko gauti valiutų kurso. Bandykite dar kartą vėliau.',
        oldConversion: 'Sena Konversija',
        fxFee: 'FX Fee',
        tax: 'Mokestis',
        enabled: 'Įjungta',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    hu: {
        exchangeSelected: 'Kiválasztott Átváltási Arány:',
        enteredValue: 'Beírt Érték:',
        result: 'Eredmény:',
        errorTitle: 'Átváltási Hiba ❌',
        errorDescription: 'Nem sikerült lekérni az árfolyamot. Kérjük, próbálja újra később.',
        oldConversion: 'Régi Konverzió',
        fxFee: 'FX Fee',
        tax: 'Adó',
        enabled: 'Engedélyezve',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    nl: {
        exchangeSelected: 'Geselecteerde Wisselkoers:',
        enteredValue: 'Ingevoerde Waarde:',
        result: 'Resultaat:',
        errorTitle: 'Conversiefout ❌',
        errorDescription: 'Kon de wisselkoers niet ophalen. Probeer het later opnieuw.',
        oldConversion: 'Oude Conversie',
        fxFee: 'FX Fee',
        tax: 'Belasting',
        enabled: 'Ingeschakeld',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    no: {
        exchangeSelected: 'Valutaveksling Valgt:',
        enteredValue: 'Inntastet Verdi:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfeil ❌',
        errorDescription: 'Kunne ikke hente valutakurs. Vennligst prøv igjen senere.',
        oldConversion: 'Gammel Konvertering',
        fxFee: 'FX Fee',
        tax: 'Skatt',
        enabled: 'Aktivert',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    pl: {
        exchangeSelected: 'Wybrany Kurs Wymiany:',
        enteredValue: 'Wprowadzona Wartość:',
        result: 'Wynik:',
        errorTitle: 'Błąd Konwersji ❌',
        errorDescription: 'Nie udało się pobrać kursu wymiany. Spróbuj ponownie później.',
        oldConversion: 'Stara Konwersja',
        fxFee: 'FX Fee',
        tax: 'Podatek',
        enabled: 'Włączona',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    'pt-BR': {
        exchangeSelected: 'Câmbio Selecionado:',
        enteredValue: 'Valor Informado:',
        result: 'Resultado:',
        errorTitle: 'Erro na Conversão ❌',
        errorDescription: 'Não foi possível obter a taxa de câmbio. Por favor, tente novamente mais tarde.',
        oldConversion: 'Conversão Antiga',
        fxFee: 'FX Fee',
        tax: 'Taxa',
        enabled: 'Ativada',
        devExCalculator: 'Calculadora DevEx Roblox',
    },
    ro: {
        exchangeSelected: 'Schimb Valutar Selectat:',
        enteredValue: 'Valoare Introduc:',
        result: 'Rezultat:',
        errorTitle: 'Eroare de Conversie ❌',
        errorDescription: 'Nu s-a putut prelua cursul valutar. Încercați din nou mai târziu.',
        oldConversion: 'Conversie Veche',
        fxFee: 'FX Fee',
        tax: 'Taxă',
        enabled: 'Activată',
        devExCalculator: 'Calculator DevEx Roblox',
    },
    fi: {
        exchangeSelected: 'Valittu Vaihtokurssi:',
        enteredValue: 'Syötetty Arvo:',
        result: 'Tulos:',
        errorTitle: 'Muuntovirhe ❌',
        errorDescription: 'Vaihtokurssin haku epäonnistui. Yritä myöhemmin uudelleen.',
        oldConversion: 'Vanha Muunnos',
        fxFee: 'FX Fee',
        tax: 'Verot',
        enabled: 'Käytössä',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    'sv-SE': {
        exchangeSelected: 'Valt Växlingskurs:',
        enteredValue: 'Angivet Värde:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfel ❌',
        errorDescription: 'Kunde inte hämta växelkurs. Försök igen senare.',
        oldConversion: 'Gammal Konvertering',
        fxFee: 'FX Fee',
        tax: 'Skatt',
        enabled: 'Aktiverad',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    vi: {
        exchangeSelected: 'Tỷ Giá Đã Chọn:',
        enteredValue: 'Giá Trị Nhập Vào:',
        result: 'Kết Quả:',
        errorTitle: 'Lỗi Chuyển Đổi ❌',
        errorDescription: 'Không thể truy xuất tỷ giá. Vui lòng thử lại sau.',
        oldConversion: 'Chuyển Đổi Cũ',
        fxFee: 'FX Fee',
        tax: 'Thuế',
        enabled: 'Đã Bật',
        devExCalculator: 'Máy Tính DevEx Roblox',
    },
    tr: {
        exchangeSelected: 'Seçilen Döviz Kuru:',
        enteredValue: 'Girilen Değer:',
        result: 'Sonuç:',
        errorTitle: 'Dönüşüm Hatası ❌',
        errorDescription: 'Döviz kuru alınamadı. Lütfen daha sonra tekrar deneyin.',
        oldConversion: 'Eski Dönüşüm',
        fxFee: 'FX Fee',
        tax: 'Vergi',
        enabled: 'Etkin',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    cs: {
        exchangeSelected: 'Vybraný Směnný Kurz:',
        enteredValue: 'Zadaná Hodnota:',
        result: 'Výsledek:',
        errorTitle: 'Chyba Převodu ❌',
        errorDescription: 'Nepodařilo se načíst směnný kurz. Zkuste to prosím později.',
        oldConversion: 'Starý Převod',
        fxFee: 'FX Fee',
        tax: 'Daň',
        enabled: 'Aktivní',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    el: {
        exchangeSelected: 'Επιλεγμένη Ισοτιμία:',
        enteredValue: 'Καταχωρημένη Τιμή:',
        result: 'Αποτέλεσμα:',
        errorTitle: 'Σφάλμα Μετατροπής ❌',
        errorDescription: 'Δεν ήταν δυνατή η ανάκτηση της ισοτιμίας. Παρακαλώ δοκιμάστε αργότερα.',
        oldConversion: 'Παλιά Μετατροπή',
        fxFee: 'FX Fee',
        tax: 'Φόρος',
        enabled: 'Ενεργοποιημένο',
        devExCalculator: 'Υπολογιστής DevEx Roblox',
    },
    bg: {
        exchangeSelected: 'Избран Валутен Курс:',
        enteredValue: 'Въведена Стойност:',
        result: 'Резултат:',
        errorTitle: 'Грешка при Конвертиране ❌',
        errorDescription: 'Неуспешно извличане на валутния курс. Моля, опитайте по-късно.',
        oldConversion: 'Стара Конверсия',
        fxFee: 'FX Fee',
        tax: 'Такса',
        enabled: 'Активирано',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    ru: {
        exchangeSelected: 'Выбранный Курс Обмена:',
        enteredValue: 'Введённое Значение:',
        result: 'Результат:',
        errorTitle: 'Ошибка Конвертации ❌',
        errorDescription: 'Не удалось получить обменный курс. Пожалуйста, попробуйте позже.',
        oldConversion: 'Старая Конверсия',
        fxFee: 'FX Fee',
        tax: 'Налог',
        enabled: 'Включено',
        devExCalculator: 'Калькулятор DevEx Roblox',
    },
    uk: {
        exchangeSelected: 'Обраний Курс Обміну:',
        enteredValue: 'Введене Значення:',
        result: 'Результат:',
        errorTitle: 'Помилка Конвертації ❌',
        errorDescription: 'Не вдалося отримати курс обміну. Будь ласка, спробуйте пізніше.',
        oldConversion: 'Стара Конверсія',
        fxFee: 'FX Fee',
        tax: 'Податок',
        enabled: 'Увімкнено',
        devExCalculator: 'Калькулятор DevEx Roblox',
    },
    hi: {
        exchangeSelected: 'चयनित विनिमय दर:',
        enteredValue: 'दर्ज किया गया मान:',
        result: 'परिणाम:',
        errorTitle: 'रूपांतरण त्रुटि ❌',
        errorDescription: 'विनिमय दर प्राप्त नहीं हो सकी। कृपया बाद में पुनः प्रयास करें।',
        oldConversion: 'पुराना रूपांतरण',
        fxFee: 'FX Fee',
        tax: 'कर',
        enabled: 'सक्रिय',
        devExCalculator: 'Roblox DevEx Calculator',
    },
    th: {
        exchangeSelected: 'อัตราแลกเปลี่ยนที่เลือก:',
        enteredValue: 'ค่าที่ป้อน:',
        result: 'ผลลัพธ์:',
        errorTitle: 'ข้อผิดพลาดในการแปลง ❌',
        errorDescription: 'ไม่สามารถดึงอัตราแลกเปลี่ยนได้ กรุณาลองใหม่ในภายหลัง',
        oldConversion: 'การแปลงเก่า',
        fxFee: 'FX Fee',
        tax: 'ภาษี',
        enabled: 'เปิดใช้งาน',
        devExCalculator: 'เครื่องคิดเลข DevEx Roblox',
    },
    'zh-CN': {
        exchangeSelected: '选择的汇率:',
        enteredValue: '输入的值:',
        result: '结果:',
        errorTitle: '转换错误 ❌',
        errorDescription: '无法获取汇率。请稍后再试。',
        oldConversion: '旧转换',
        fxFee: 'FX Fee',
        tax: '税',
        enabled: '启用',
        devExCalculator: 'Roblox DevEx 计算器',
    },
    ja: {
        exchangeSelected: '選択した為替レート:',
        enteredValue: '入力された値:',
        result: '結果:',
        errorTitle: '変換エラー ❌',
        errorDescription: '為替レートを取得できませんでした。後でもう一度お試しください。',
        oldConversion: '古い換算',
        fxFee: 'FX Fee',
        tax: '手数料',
        enabled: '有効',
        devExCalculator: 'Roblox DevEx 計算機',
    },
    'zh-TW': {
        exchangeSelected: '選擇的匯率:',
        enteredValue: '輸入的值:',
        result: '結果:',
        errorTitle: '轉換錯誤 ❌',
        errorDescription: '無法獲取匯率。請稍後再試。',
        oldConversion: '舊轉換',
        fxFee: 'FX Fee',
        tax: '稅',
        enabled: '啟用',
        devExCalculator: 'Roblox DevEx 計算器',
    },
    ko: {
        exchangeSelected: '선택한 환율:',
        enteredValue: '입력된 값:',
        result: '결과:',
        errorTitle: '변환 오류 ❌',
        errorDescription: '환율을 가져올 수 없습니다. 나중에 다시 시도하십시오.',
        oldConversion: '이전 변환',
        fxFee: 'FX Fee',
        tax: '세금',
        enabled: '활성화됨',
        devExCalculator: 'Roblox DevEx 계산기',
    },
};

function GetTranslation(Locale: string, Key: string): string {

    const Lang = Locale.split('-')[0];

    return Translations[Locale]?.[Key] || Translations[Lang]?.[Key] || Translations['en-US'][Key] || Key;

}

const Command = {

    data: new SlashCommandBuilder()

        .setName('devex')
        .setDescription('Calcula o valor em DevEx do Roblox')
        .setDescriptionLocalizations({
            id: 'Menghitung nilai DevEx di Roblox',
            da: 'Beregner DevEx-værdien i Roblox',
            de: 'Berechnet den DevEx-Wert von Roblox',
            'en-GB': 'Calculates the DevEx value in Roblox',
            'en-US': 'Calculates the DevEx value in Roblox',
            'es-ES': 'Calcula el valor en DevEx en Roblox',
            'es-419': 'Calcula el valor en DevEx en Roblox',
            fr: 'Calcule la valeur DevEx dans Roblox',
            hr: 'Izračunava DevEx vrijednost u Robloxu',
            it: 'Calcola il valore DevEx su Roblox',
            lt: 'Apskaičiuoja DevEx vertę Roblox',
            hu: 'Kiszámítja a DevEx értéket a Robloxban',
            nl: 'Bereken de DevEx-waarde in Roblox',
            no: 'Beregner DevEx-verdien i Roblox',
            pl: 'Oblicza wartość DevEx w Roblox',
            'pt-BR': 'Calcula o valor em DevEx do Roblox',
            ro: 'Calculează valoarea DevEx în Roblox',
            fi: 'Laskee DevEx-arvon Robloxissa',
            'sv-SE': 'Beräknar DevEx-värdet i Roblox',
            vi: 'Tính giá trị DevEx trong Roblox',
            tr: 'Roblox’ta DevEx değerini hesaplar',
            cs: 'Vypočítá hodnotu DevEx v Robloxu',
            el: 'Υπολογίζει την τιμή DevEx στο Roblox',
            bg: 'Изчислява стойността на DevEx в Roblox',
            ru: 'Вычисляет значение DevEx в Roblox',
            uk: 'Розраховує значення DevEx у Roblox',
            hi: 'Roblox में DevEx मान की गणना करता है',
            th: 'คำนวณค่า DevEx ใน Roblox',
            'zh-CN': '计算 Roblox 中的 DevEx 值',
            ja: 'Roblox の DevEx 値を計算します',
            'zh-TW': '計算 Roblox 中的 DevEx 值',
            ko: 'Roblox에서 DevEx 값을 계산합니다',
        })

        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)

        .addStringOption(Option =>
            Option.setName('cambio')
                .setNameLocalizations({
                    id: 'mata_uang', da: 'valuta', de: 'wechselkurs', 'en-GB': 'currency', 'en-US': 'currency',
                    'es-ES': 'divisa', 'es-419': 'divisa', fr: 'devise', hr: 'valuta', it: 'valuta', lt: 'valiuta',
                    hu: 'valuta', nl: 'valuta', no: 'valuta', pl: 'waluta', 'pt-BR': 'moeda', ro: 'valută',
                    fi: 'valuutta', 'sv-SE': 'valuta', vi: 'tiente', tr: 'doviz', cs: 'mena', el: 'νόμισμα',
                    bg: 'валута', ru: 'валюта', uk: 'валюта', hi: 'मुद्रा', th: 'สกุลเงิน',
                    'zh-CN': '货币', ja: '通貨', 'zh-TW': '貨幣', ko: '화폐',
                })
                .setDescription('Escolha o câmbio de dinheiro que deseja converter')
                .setDescriptionLocalizations({
                    id: 'Pilih mata uang untuk dikonversi', da: 'Vælg valuta at konvertere til', de: 'Wählen Sie die Währung, die Sie umrechnen möchten',
                    'en-GB': 'Choose the currency to convert to', 'en-US': 'Choose the currency to convert to',
                    'es-ES': 'Elija la moneda que desea convertir', 'es-419': 'Elija la moneda que desea convertir',
                    fr: 'Choisissez la devise à convertir', hr: 'Odaberite valutu za pretvorbu',
                    it: 'Scegli la valuta da convertire', lt: 'Pasirinkite valiutą konvertavimui',
                    hu: 'Válassza ki az átváltandó pénznemet', nl: 'Kies de valuta om naar om te rekenen',
                    no: 'Velg valuta for konvertering', pl: 'Wybierz walutę do przeliczenia',
                    'pt-BR': 'Escolha o câmbio de dinheiro que deseja converter', ro: 'Alegeți moneda de convertit',
                    fi: 'Valitse valuutta, johon haluat muuntaa', 'sv-SE': 'Välj valuta att konvertera till',
                    vi: 'Chọn loại tiền để chuyển đổi', tr: 'Dönüştürülecek para birimini seçin',
                    cs: 'Vyberte měnu k převodu', el: 'Επιλέξτε το νόμισμα προς μετατροπή',
                    bg: 'Изберете валута за конвертиране', ru: 'Выберите валюту для конвертации',
                    uk: 'Оберіть валюту для конвертації', hi: 'कृपया मुद्रा चुनें', th: 'เลือกสกุลเงินที่จะคำนวณ',
                    'zh-CN': '选择要转换的货币', ja: '変換する通貨を選択してください',
                    'zh-TW': '選擇要轉換的貨幣', ko: '변환할 통화를 선택하세요',
                })
                .setRequired(true)
                .addChoices(
                    { name: 'BRL 🇧🇷', value: 'brl' },
                    { name: 'USD 🇺🇸', value: 'usd' },
                    { name: 'EUR 🇪🇺', value: 'eur' },
                    { name: 'GBP 🇬🇧', value: 'gbp' },
                    { name: 'JPY 🇯🇵', value: 'jpy' },
                    { name: 'AUD 🇦🇺', value: 'aud' },
                    { name: 'CAD 🇨🇦', value: 'cad' },
                    { name: 'CHF 🇨🇭', value: 'chf' },
                    { name: 'CNY 🇨🇳', value: 'cny' },
                    { name: 'SEK 🇸🇪', value: 'sek' },
                    { name: 'NZD 🇳🇿', value: 'nzd' },
                    { name: 'MXN 🇲🇽', value: 'mxn' },
                    { name: 'SGD 🇸🇬', value: 'sgd' },
                    { name: 'HKD 🇭🇰', value: 'hkd' },
                    { name: 'NOK 🇳🇴', value: 'nok' },
                    { name: 'KRW 🇰🇷', value: 'krw' },
                    { name: 'TRY 🇹🇷', value: 'try' },
                    { name: 'INR 🇮🇳', value: 'inr' },
                    { name: 'ZAR 🇿🇦', value: 'zar' },
                    { name: 'PLN 🇵🇱', value: 'pln' },
                    { name: 'DKK 🇩🇰', value: 'dkk' },
                    { name: 'VND 🇻🇳', value: 'vnd' },
                    { name: 'AED 🇦🇪', value: 'aed' }
                )
        )

        .addIntegerOption(Option =>
            Option.setName('valor')
                .setNameLocalizations({
                    id: 'nilai', da: 'værdi', de: 'wert', 'en-GB': 'value', 'en-US': 'value',
                    'es-ES': 'valor', 'es-419': 'valor', fr: 'valeur', hr: 'vrijednost', it: 'valore',
                    lt: 'vertė', hu: 'érték', nl: 'waarde', no: 'verdi', pl: 'wartość', 'pt-BR': 'valor',
                    ro: 'valoare', fi: 'arvo', 'sv-SE': 'värde', vi: 'giatri', tr: 'deger', cs: 'hodnota',
                    el: 'τιμή', bg: 'стойност', ru: 'значение', uk: 'значення', hi: 'मान', th: 'ค่า',
                    'zh-CN': '数值', ja: '値', 'zh-TW': '數值', ko: '값',
                })
                .setDescription('Valor total para ser convertido')
                .setDescriptionLocalizations({
                    id: 'Nilai total yang akan dikonversi', da: 'Samlet værdi der skal konverteres', de: 'Gesamtwert zur Umrechnung',
                    'en-GB': 'Total value to convert', 'en-US': 'Total value to convert', 'es-ES': 'Valor total a convertir',
                    'es-419': 'Valor total a convertir', fr: 'Valeur totale à convertir', hr: 'Ukupna vrijednost za pretvorbu',
                    it: 'Valore totale da convertire', lt: 'Bendra vertė konvertavimui', hu: 'Teljes érték az átváltáshoz',
                    nl: 'Totale waarde om te converteren', no: 'Totalverdi som skal konverteres', pl: 'Łączna wartość do przeliczenia',
                    'pt-BR': 'Valor total para ser convertido', ro: 'Valoare totală de convertit', fi: 'Muunnettava kokonaisarvo',
                    'sv-SE': 'Totalt värde att konvertera', vi: 'Giá trị tổng cần chuyển đổi', tr: 'Dönüştürülecek toplam değer',
                    cs: 'Celková hodnota k převodu', el: 'Συνολική αξία προς μετατροπή', bg: 'Обща стойност за конвертиране',
                    ru: 'Общая сумма для конвертации', uk: 'Загальна сума для конвертації', hi: 'कुल मूल्य परिवर्तित करें',
                    th: 'มูลค่ารวมที่จะคำนวณ', 'zh-CN': '要转换的总价值', ja: '変換する合計値', 'zh-TW': '要轉換的總價值', ko: '변환할 총 가치',
                })
                .setRequired(true)
        )

        .addBooleanOption(Option =>
            Option.setName('old_conversion_rate')
                .setNameLocalizations({
                    id: 'conversao_antiga', da: 'gammel_kurs', de: 'alter_kurs', 'en-GB': 'old_conversion_rate', 'en-US': 'old_conversion_rate',
                    'es-ES': 'conversion_antigua', 'es-419': 'conversion_antigua', fr: 'conversion_ancienne', hr: 'stara_stopa',
                    it: 'conversione_vecchia', lt: 'senas_kursas', hu: 'régi_árfolyam', nl: 'oude_koers', no: 'gammel_kurs',
                    pl: 'stara_konwersja', 'pt-BR': 'conversao_antiga', ro: 'rata_veche', fi: 'vanha_kurssi', 'sv-SE': 'gammal_kurs',
                    vi: 'tygia_cu', tr: 'eski_kur', cs: 'stara_mira', el: 'παλιά_ισοτιμία', bg: 'стар_курс',
                    ru: 'старый_курс', uk: 'старий_курс', hi: 'पुरानी_दर', th: 'อัตราเก่า', 'zh-CN': '旧汇率', ja: '旧為替レート', 'zh-TW': '舊匯率', ko: '이전_환율',
                })
                .setDescription('Usar conversão antiga (0.0035)')
                .setDescriptionLocalizations({
                    id: 'Gunakan konversi lama (0.0035)',
                    da: 'Brug gammel konverteringsrate (0.0035)',
                    de: 'Alte Konversionsrate verwenden (0.0035)',
                    'en-GB': 'Use old conversion rate (0.0035)',
                    'en-US': 'Use old conversion rate (0.0035)',
                    'es-ES': 'Usar conversión antigua (0.0035)',
                    'es-419': 'Usar conversión antigua (0.0035)',
                    fr: 'Utiliser l’ancienne conversion (0.0035)',
                    hr: 'Koristite staru konverziju (0.0035)',
                    it: 'Usa la vecchia conversione (0.0035)',
                    lt: 'Naudoti seną konversijos kursą (0.0035)',
                    hu: 'Régi konverzió használata (0.0035)',
                    nl: 'Oude conversieratio gebruiken (0.0035)',
                    no: 'Bruk gammel konverteringsrate (0.0035)',
                    pl: 'Użyj starej konwersji (0.0035)',
                    'pt-BR': 'Usar conversão antiga (0.0035)',
                    ro: 'Folosește conversia veche (0.0035)',
                    fi: 'Käytä vanhaa muuntokurssia (0.0035)',
                    'sv-SE': 'Använd gammal konverteringskurs (0.0035)',
                    vi: 'Sử dụng tỷ lệ chuyển đổi cũ (0.0035)',
                    tr: 'Eski dönüştürme oranını kullan (0.0035)',
                    cs: 'Použít starou konverzi (0.0035)',
                    el: 'Χρήση παλιάς μετατροπής (0.0035)',
                    bg: 'Използвайте старата конверсия (0.0035)',
                    ru: 'Использовать старую конверсию (0.0035)',
                    uk: 'Використовувати стару конверсію (0.0035)',
                    hi: 'पुराना रूपांतरण दर उपयोग करें (0.0035)',
                    th: 'ใช้การแปลงเก่า (0.0035)',
                    'zh-CN': '使用旧转换率 (0.0035)',
                    ja: '古い換算率を使用 (0.0035)',
                    'zh-TW': '使用舊轉換率 (0.0035)',
                    ko: '이전 환율 사용 (0.0035)',
                })
        )

        .addBooleanOption(Option =>
            Option.setName('taxa')
                .setNameLocalizations({
                    id: 'biaya', da: 'afgift', de: 'gebühr', 'en-GB': 'tax', 'en-US': 'tax', 'es-ES': 'tarifa',
                    'es-419': 'tarifa', fr: 'frais', hr: 'naknada', it: 'tassa', lt: 'mokestis', hu: 'díj',
                    nl: 'vergoeding', no: 'avgift', pl: 'opłata', 'pt-BR': 'taxa', ro: 'taxă', fi: 'maksu',
                    'sv-SE': 'avgift', vi: 'phi', tr: 'ucret', cs: 'poplatek', el: 'τέλος', bg: 'такса', ru: 'плата',
                    uk: 'збір', hi: 'शुल्क', th: 'ค่าธรรมเนียม', 'zh-CN': '费用', ja: '手数料', 'zh-TW': '費用', ko: '수수료',
                })
                .setDescription('Aplicar taxa fixa de -5 USD')
                .setDescriptionLocalizations({
                    id: 'Terapkan biaya tetap -5 USD',
                    da: 'Anvend fast gebyr på -5 USD',
                    de: 'Feste Gebühr von -5 USD anwenden',
                    'en-GB': 'Apply fixed fee of -5 USD',
                    'en-US': 'Apply fixed fee of -5 USD',
                    'es-ES': 'Aplicar tarifa fija de -5 USD',
                    'es-419': 'Aplicar tarifa fija de -5 USD',
                    fr: 'Appliquer des frais fixes de -5 USD',
                    hr: 'Primijeni fiksnu naknadu od -5 USD',
                    it: 'Applica tassa fissa di -5 USD',
                    lt: 'Taikyti fiksuotą -5 USD mokestį',
                    hu: 'Alkalmazzon fix -5 USD díjat',
                    nl: 'Vaste vergoeding van -5 USD toepassen',
                    no: 'Bruk fast gebyr på -5 USD',
                    pl: 'Zastosuj stałą opłatę -5 USD',
                    'pt-BR': 'Aplicar taxa fixa de -5 USD',
                    ro: 'Aplică taxa fixă de -5 USD',
                    fi: 'Käytä kiinteää -5 USD maksua',
                    'sv-SE': 'Tillämpa fast avgift på -5 USD',
                    vi: 'Áp dụng phí cố định -5 USD',
                    tr: 'Sabit -5 USD ücreti uygulayın',
                    cs: 'Aplikovat pevný poplatek -5 USD',
                    el: 'Εφαρμόστε σταθερό τέλος -5 USD',
                    bg: 'Приложи фиксирана такса -5 USD',
                    ru: 'Применить фиксированный сбор -5 USD',
                    uk: 'Застосувати фіксований збір -5 USD',
                    hi: 'स्थिर शुल्क -5 USD लागू करें',
                    th: 'ใช้ค่าธรรมเนียมคงที่ -5 USD',
                    'zh-CN': '应用固定手续费 -5 美元',
                    ja: '固定料金 -5 USD を適用',
                    'zh-TW': '套用固定費用 -5 美元',
                    ko: '고정 수수료 -5 USD 적용',
                })
        )

        .addBooleanOption(Option =>
            Option.setName('fx_fee')
                .setNameLocalizations({
                    id: 'biaya_fx',
                    da: 'valutagebyr',
                    de: 'fx_gebuehr',
                    'en-GB': 'fx_fee',
                    'en-US': 'fx_fee',
                    'es-ES': 'comision_fx',
                    'es-419': 'comision_fx',
                    fr: 'frais_fx',
                    hr: 'naknada_fx',
                    it: 'commissione_fx',
                    lt: 'mokescio_fx',
                    hu: 'fx_dij',
                    nl: 'fx_kosten',
                    no: 'valutagebyr',
                    pl: 'oplata_fx',
                    'pt-BR': 'taxa_fx',
                    ro: 'taxa_fx',
                    fi: 'maksu_fx',
                    'sv-SE': 'avgift_fx',
                    vi: 'phi_fx',
                    tr: 'ucret_fx',
                    cs: 'poplatek_fx',
                    el: 'telas_fx',
                    bg: 'taksa_fx',
                    ru: 'plata_fx',
                    uk: 'zbir_fx',
                    hi: 'shulk_fx',
                    th: 'fx_fee',
                    'zh-CN': 'fx_fee',
                    ja: 'fx_fee',
                    'zh-TW': 'fx_fee',
                    ko: 'fx_fee',
                })
                .setDescription('Aplicar taxa de câmbio adicional (FX Fee)')
                .setDescriptionLocalizations({
                    id: 'Terapkan biaya FX tambahan',
                    da: 'Anvend ekstra valutagebyr (FX Fee)',
                    de: 'Zusätzliche FX-Gebühr anwenden',
                    'en-GB': 'Apply additional FX fee',
                    'en-US': 'Apply additional FX fee',
                    'es-ES': 'Aplicar tarifa FX adicional',
                    'es-419': 'Aplicar tarifa FX adicional',
                    fr: 'Appliquer les frais FX supplémentaires',
                    hr: 'Primijeni dodatnu FX naknadu',
                    it: 'Applica commissione FX aggiuntiva',
                    lt: 'Taikyti papildomą FX mokestį',
                    hu: 'Alkalmazzon további FX díjat',
                    nl: 'Extra FX-kosten toepassen',
                    no: 'Bruk ekstra valutaavgift (FX Fee)',
                    pl: 'Zastosuj dodatkową opłatę FX',
                    'pt-BR': 'Aplicar taxa de câmbio adicional (FX Fee)',
                    ro: 'Aplică taxa FX suplimentară',
                    fi: 'Sovella lisävaluuttamaksu (FX Fee)',
                    'sv-SE': 'Tillämpa extra FX-avgift',
                    vi: 'Áp dụng phí FX bổ sung',
                    tr: 'Ek FX ücreti uygulayın',
                    cs: 'Použít další FX poplatek',
                    el: 'Εφαρμόστε επιπλέον χρέωση FX',
                    bg: 'Приложи допълнителна такса FX',
                    ru: 'Применить дополнительную FX комиссию',
                    uk: 'Застосувати додаткову плату FX',
                    hi: 'अतिरिक्त FX शुल्क लागू करें',
                    th: 'ใช้ค่าธรรมเนียม FX เพิ่มเติม',
                    'zh-CN': '应用额外的外汇费用 (FX Fee)',
                    ja: '追加のFX手数料を適用',
                    'zh-TW': '套用額外外匯費用 (FX Fee)',
                    ko: '추가 FX 수수료 적용',
                })
        ),

    async run(Client: any, Interaction: any) {

        const Cambio = Interaction.options.getString('cambio');
        const Valor = Interaction.options.getInteger('valor');
        const OldRate = Interaction.options.getBoolean('old_conversion_rate') || false;
        const ApplyTaxa = Interaction.options.getBoolean('taxa') || false;
        const ApplyFxFee = Interaction.options.getBoolean('fx_fee') || false;
        const Locale = Interaction.locale || 'en-US';
        const IsInteractionAlreadyAcknowledged = (Error: any): boolean => {
            return Error?.code === 40060 || Error?.rawError?.code === 40060;
        };

        const EnsureInteractionAcknowledged = async (): Promise<boolean> => {
            if (Interaction.deferred || Interaction.replied) {
                return true;
            }

            try {
                await Interaction.deferReply();
                return true;
            } catch (Error) {
                if (IsInteractionAlreadyAcknowledged(Error)) {
                    return false;
                }

                throw Error;
            }
        };

        const Respond = async (Payload: any) => {
            const CanReply = await EnsureInteractionAcknowledged();
            if (!CanReply) {
                return;
            }

            try {
                await Interaction.editReply(Payload);
            } catch (Error) {
                if (IsInteractionAlreadyAcknowledged(Error)) {
                    return;
                }

                throw Error;
            }
        };

        try {
            const CanReply = await EnsureInteractionAcknowledged();
            if (!CanReply) {
                return;
            }

            const ConversionRate = OldRate ? 0.0035 : 0.0038;
            let ExchangeRate = 1;

            if (Cambio !== 'usd') {

                const CurrencyPair = `USD-${Cambio.toUpperCase()}`;

                const JsonKey = `USD${Cambio.toUpperCase()}`;

                const Now = Date.now();

                if (ExchangeCache.has(CurrencyPair) && (Now - ExchangeCache.get(CurrencyPair)!.timestamp < CACHE_DURATION)) {
                    ExchangeRate = ExchangeCache.get(CurrencyPair)!.rate;
                    console.log(`[Cache] Taxa recuperada para ${CurrencyPair}: ${ExchangeRate}`);
                }
                else {
                    const ApiKey = process.env.ECONOMIA_API_KEY;

                    if (!ApiKey) {
                        console.error('ERRO CRÍTICO: ECONOMIA_API_KEY não encontrada no process.env');
                    }

                    const TokenParam = ApiKey ? `?token=${ApiKey}` : '';

                    const Url = `https://economia.awesomeapi.com.br/json/last/${CurrencyPair}${TokenParam}`;

                    const Response = await fetch(Url);

                    if (!Response.ok) {
                        throw new Error(`Erro na API (${Response.status}): ${Response.statusText}`);
                    }

                    const Data: any = await Response.json();

                    if (!Data[JsonKey] || !Data[JsonKey].ask) {
                        console.error('Resposta da API:', JSON.stringify(Data));
                        throw new Error(`Moeda ${JsonKey} não encontrada na resposta.`);
                    }

                    ExchangeRate = parseFloat(Data[JsonKey].ask);

                    ExchangeCache.set(CurrencyPair, {
                        rate: ExchangeRate,
                        timestamp: Now
                    });

                    console.log(`[API] Sucesso! Nova taxa para ${JsonKey}: ${ExchangeRate}`);
                }
            }

            let ConvertedValue = Valor * ConversionRate;

            if (ApplyTaxa) ConvertedValue -= 5;

            if (ApplyFxFee && Cambio !== 'usd') {
                const FxFeeRate = ConvertedValue <= 4999.99 ? 0.025 : 0.019;
                ConvertedValue -= ConvertedValue * FxFeeRate;
            }

            if (ConvertedValue < 0) ConvertedValue = 0;

            ConvertedValue *= ExchangeRate;

            const Formatter = new Intl.NumberFormat(Interaction.locale || 'en-US', {

                style: 'currency',
                currency: Cambio.toUpperCase(),
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,

            });

            const Fields = [

                {
                    name: GetTranslation(Locale, 'exchangeSelected'),
                    value: Cambio.toUpperCase(),
                    inline: true

                },

                {

                    name: GetTranslation(Locale, 'enteredValue'),
                    value: `<:Robux:1311957287178469447> ${Valor.toLocaleString()}`,
                    inline: true

                },

            ];

            if (OldRate) {

                Fields.push({

                    name: GetTranslation(Locale, 'oldConversion'),
                    value: GetTranslation(Locale, 'enabled'),
                    inline: true

                });

            }

            if (ApplyTaxa) {

                Fields.push({

                    name: GetTranslation(Locale, 'tax'),
                    value: '-$5',
                    inline: true

                });

            }

            if (ApplyFxFee) {

                Fields.push({

                    name: GetTranslation(Locale, 'fxFee'),
                    value: GetTranslation(Locale, 'enabled'),
                    inline: true

                });

            }

            Fields.push({

                name: GetTranslation(Locale, 'result'),
                value: `${Formatter.format(ConvertedValue)}`,
                inline: false,

            });

            const Embed = new EmbedBuilder()

                .setColor('#98F768')
                .setTitle('<:Robux:1311957287178469447> Roblox DevEx Calculator')
                .addFields(Fields);

            await Respond({ embeds: [Embed] });

        } catch (Error) {
            if (IsInteractionAlreadyAcknowledged(Error)) {
                return;
            }

            console.error('Erro ao obter o valor de câmbio:', Error);

            const ErrorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(GetTranslation(Locale, 'errorTitle'))
                .setDescription(GetTranslation(Locale, 'errorDescription'));

            try {
                if (Interaction.deferred || Interaction.replied) {
                    await Interaction.editReply({ embeds: [ErrorEmbed] });
                } else {
                    await Interaction.reply({
                        embeds: [ErrorEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } catch (ReplyError) {
                if (IsInteractionAlreadyAcknowledged(ReplyError)) {
                    return;
                }

                console.error('[DEVEX] Falha ao responder interacao com erro:', ReplyError);
            }

        }

    }

}

export default Command;
