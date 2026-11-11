// Données d'exemple et titres des captures, par langue de l'app.
// Réservé aux captures : jamais dans l'app (injecté dans le localStorage du navigateur de capture).

// Titres : [ligne 1, ligne 2 en couleur, sous-titre], dans l'ordre des 7 écrans
// matrice, dictée, calendrier, avancement, bilan, revue, sauvegarde
export const TITLES = {
  fr: [
    ["Fais d’abord", "ce qui compte", "Tes tâches rangées en 4 cases, en un coup d’œil"],
    ["Dicte ta tâche,", "l’app la range", "Un micro, deux questions, et c’est classé"],
    ["Ta journée", "en un coup d’œil", "Calendrier et frise horaire de chaque jour"],
    ["Avance", "pas à pas", "Étapes, séances et % d’avancement"],
    ["Moins d’urgences,", "plus d’anticipation", "Ton équilibre, semaine après semaine"],
    ["Ta revue", "de la semaine", "5 minutes pour choisir tes priorités"],
    ["Tes tâches", "en sécurité", "Sauvegarde Google Drive facultative"],
  ],
  en: [
    ["Do first", "what matters", "Your tasks sorted into 4 boxes, at a glance"],
    ["Say your task,", "the app sorts it", "A mic, two questions, and it's filed"],
    ["Your day", "at a glance", "Calendar and timeline for every day"],
    ["Move forward", "step by step", "Steps, sessions and % progress"],
    ["Fewer emergencies,", "more planning ahead", "Your balance, week after week"],
    ["Your", "weekly review", "5 minutes to choose your priorities"],
    ["Your tasks,", "safe and sound", "Optional Google Drive backup"],
  ],
  es: [
    ["Haz primero", "lo que importa", "Tus tareas en 4 cuadrantes, de un vistazo"],
    ["Dicta tu tarea,", "la app la ordena", "Un micrófono, dos preguntas y listo"],
    ["Tu día", "de un vistazo", "Calendario y franja horaria de cada día"],
    ["Avanza", "paso a paso", "Pasos, sesiones y % de progreso"],
    ["Menos urgencias,", "más previsión", "Tu equilibrio, semana tras semana"],
    ["Tu revisión", "de la semana", "5 minutos para elegir tus prioridades"],
    ["Tus tareas,", "a salvo", "Copia opcional en Google Drive"],
  ],
  "pt-BR": [
    ["Faça primeiro", "o que importa", "Suas tarefas em 4 quadrantes, num relance"],
    ["Dite sua tarefa,", "o app organiza", "Um microfone, duas perguntas e pronto"],
    ["Seu dia", "num relance", "Calendário e linha do tempo de cada dia"],
    ["Avance", "passo a passo", "Etapas, sessões e % de progresso"],
    ["Menos urgências,", "mais planejamento", "Seu equilíbrio, semana após semana"],
    ["Sua revisão", "da semana", "5 minutos para escolher suas prioridades"],
    ["Suas tarefas", "em segurança", "Backup opcional no Google Drive"],
  ],
  de: [
    ["Zuerst das,", "was zählt", "Deine Aufgaben in 4 Feldern, auf einen Blick"],
    ["Aufgabe diktieren,", "die App sortiert", "Ein Mikrofon, zwei Fragen, fertig"],
    ["Dein Tag", "auf einen Blick", "Kalender und Zeitleiste für jeden Tag"],
    ["Schritt", "für Schritt", "Schritte, Einheiten und Fortschritt in %"],
    ["Weniger Stress,", "mehr Planung", "Deine Balance, Woche für Woche"],
    ["Dein", "Wochenrückblick", "5 Minuten für deine Prioritäten"],
    ["Deine Aufgaben", "in Sicherheit", "Freiwillige Sicherung in Google Drive"],
  ],
  it: [
    ["Fai prima", "ciò che conta", "Le tue attività in 4 riquadri, a colpo d'occhio"],
    ["Detta l'attività,", "l'app la ordina", "Un microfono, due domande, ed è fatto"],
    ["La tua giornata", "a colpo d'occhio", "Calendario e linea oraria di ogni giorno"],
    ["Avanza", "passo dopo passo", "Passaggi, sessioni e % di avanzamento"],
    ["Meno urgenze,", "più anticipo", "Il tuo equilibrio, settimana dopo settimana"],
    ["La revisione", "della settimana", "5 minuti per scegliere le priorità"],
    ["Le tue attività", "al sicuro", "Backup facoltativo su Google Drive"],
  ],
  id: [
    ["Kerjakan dulu", "yang penting", "Tugasmu tertata dalam 4 kotak, sekilas"],
    ["Dikte tugasmu,", "aplikasi menatanya", "Satu mikrofon, dua pertanyaan, beres"],
    ["Harimu", "sekilas pandang", "Kalender dan lini waktu setiap hari"],
    ["Maju", "selangkah demi selangkah", "Langkah, sesi, dan % kemajuan"],
    ["Lebih sedikit mendadak,", "lebih banyak rencana", "Keseimbanganmu dari minggu ke minggu"],
    ["Tinjauan", "mingguanmu", "5 menit untuk memilih prioritas"],
    ["Tugasmu", "tetap aman", "Cadangan Google Drive opsional"],
  ],
  ja: [
    ["大事なことから", "先にやろう", "タスクを4つの枠にひと目で整理"],
    ["話すだけで", "アプリが整理", "マイクとふたつの質問で完了"],
    ["一日の予定が", "ひと目でわかる", "カレンダーと毎日のタイムライン"],
    ["一歩ずつ", "確実に進める", "ステップ・セッション・進み具合%"],
    ["急ぎの仕事を減らし", "先回りを増やす", "毎週のバランスをチェック"],
    ["週に一度の", "ふりかえり", "5分で優先順位を決める"],
    ["タスクを", "しっかり保存", "Google ドライブへの任意バックアップ"],
  ],
  ko: [
    ["중요한 일부터", "먼저 해요", "할 일을 4칸에 한눈에 정리"],
    ["말로 입력하면", "앱이 정리해요", "마이크와 질문 두 개면 끝"],
    ["하루 일정을", "한눈에", "캘린더와 날마다 보는 시간표"],
    ["한 걸음씩", "꾸준히", "단계, 세션, 진행률 %"],
    ["급한 일은 줄이고", "계획은 미리", "매주 확인하는 나의 균형"],
    ["한 주를", "돌아봐요", "5분이면 우선순위 정리 끝"],
    ["할 일을", "안전하게", "선택형 Google 드라이브 백업"],
  ],
  "zh-Hans": [
    ["先做", "最重要的事", "任务分进四个象限，一目了然"],
    ["说出任务，", "应用帮你归类", "一个麦克风，两个问题，搞定"],
    ["一天安排", "一目了然", "日历和每天的时间轴"],
    ["一步一步", "稳步推进", "步骤、时段和进度百分比"],
    ["少些紧急，", "多些提前规划", "每周查看你的平衡"],
    ["每周", "回顾一下", "5 分钟选出优先事项"],
    ["你的任务", "安全无忧", "可选的 Google 云端硬盘备份"],
  ],
  tr: [
    ["Önce", "önemli olanı yap", "Görevlerin 4 kutuda, tek bakışta"],
    ["Görevini söyle,", "uygulama yerleştirsin", "Bir mikrofon, iki soru, hepsi bu"],
    ["Günün", "tek bakışta", "Takvim ve her günün zaman çizelgesi"],
    ["Adım adım", "ilerle", "Adımlar, oturumlar ve % ilerleme"],
    ["Daha az acil iş,", "daha çok plan", "Haftadan haftaya dengen"],
    ["Haftalık", "değerlendirmen", "Önceliklerini seçmek için 5 dakika"],
    ["Görevlerin", "güvende", "İsteğe bağlı Google Drive yedeği"],
  ],
  hi: [
    ["पहले वो करो", "जो ज़रूरी है", "तुम्हारे काम 4 ख़ानों में, एक नज़र में"],
    ["काम बोलो,", "ऐप सँभाल लेगा", "एक माइक, दो सवाल, और काम तय"],
    ["पूरा दिन", "एक नज़र में", "हर दिन का कैलेंडर और समय-रेखा"],
    ["क़दम-दर-क़दम", "आगे बढ़ो", "क़दम, सत्र और % प्रगति"],
    ["कम हड़बड़ी,", "ज़्यादा योजना", "हफ़्ते-दर-हफ़्ते तुम्हारा संतुलन"],
    ["हफ़्ते की", "समीक्षा", "प्राथमिकताएँ चुनने के लिए 5 मिनट"],
    ["तुम्हारे काम", "सुरक्षित", "वैकल्पिक Google Drive बैकअप"],
  ],
  ru: [
    ["Сначала", "главное", "Задачи в 4 квадратах — всё видно сразу"],
    ["Продиктуй задачу —", "приложение разложит", "Микрофон, два вопроса — и готово"],
    ["Твой день", "как на ладони", "Календарь и шкала времени на каждый день"],
    ["Шаг", "за шагом", "Шаги, сессии и прогресс в %"],
    ["Меньше авралов,", "больше планов", "Твой баланс неделя за неделей"],
    ["Обзор", "недели", "5 минут, чтобы выбрать приоритеты"],
    ["Задачи", "в сохранности", "Копия в Google Диске по желанию"],
  ],
};

// Teinte de chaque écran (fond et mot en couleur), comme les captures françaises
export const THEMES = ["red", "blue", "blue", "red", "blue", "gold", "gold"];

// Tâches d'exemple : Faire ×3, Planifier ×3 (dont un projet en 5 étapes), Déléguer ×2,
// Si j'ai le temps ×2 ; titre dicté ; personne à qui on délègue
export const SAMPLES = {
  fr: {
    do: ["Appeler le plombier", "Payer la facture d’eau", "Rendre le dossier"],
    plan: ["Préparer l’exposé", "Réviser le permis", "Faire du sport"],
    steps: ["Réunir les sources", "Faire le plan", "Créer les diapos", "Répéter", "Envoyer à l’équipe"],
    delegate: ["Réserver la salle", "Relancer le devis"],
    someday: ["Trier les photos", "Ranger le garage"],
    person: "Marie",
    dictated: "Rendre le dossier client",
  },
  en: {
    do: ["Call the plumber", "Pay the water bill", "Send the client file"],
    plan: ["Prepare the talk", "Study for the test", "Go for a run"],
    steps: ["Gather sources", "Write the outline", "Make the slides", "Rehearse", "Send to the team"],
    delegate: ["Book the room", "Chase the quote"],
    someday: ["Sort the photos", "Tidy the garage"],
    person: "Sarah",
    dictated: "Send the client file",
  },
  es: {
    do: ["Llamar al fontanero", "Pagar el agua", "Entregar el informe"],
    plan: ["Preparar la charla", "Estudiar el carné", "Salir a correr"],
    steps: ["Reunir fuentes", "Hacer el esquema", "Crear las diapositivas", "Ensayar", "Enviar al equipo"],
    delegate: ["Reservar la sala", "Pedir presupuesto"],
    someday: ["Ordenar las fotos", "Ordenar el garaje"],
    person: "Lucía",
    dictated: "Entregar el informe del cliente",
  },
  "pt-BR": {
    do: ["Ligar pro encanador", "Pagar a conta de água", "Entregar o relatório"],
    plan: ["Preparar palestra", "Aula de direção", "Correr no parque"],
    steps: ["Juntar as fontes", "Fazer o roteiro", "Montar os slides", "Ensaiar", "Enviar para a equipe"],
    delegate: ["Reservar a sala", "Cobrar o orçamento"],
    someday: ["Organizar as fotos", "Arrumar a garagem"],
    person: "Ana",
    dictated: "Entregar o relatório do cliente",
  },
  de: {
    do: ["Klempner anrufen", "Rechnung bezahlen", "Akte abgeben"],
    plan: ["Vortrag planen", "Für Prüfung lernen", "Joggen gehen"],
    steps: ["Quellen sammeln", "Gliederung schreiben", "Folien erstellen", "Proben", "An das Team schicken"],
    delegate: ["Raum buchen", "Angebot nachfragen"],
    someday: ["Fotos sortieren", "Garage aufräumen"],
    person: "Anna",
    dictated: "Kundenakte abgeben",
  },
  it: {
    do: ["Chiamare l'idraulico", "Pagare la bolletta", "Consegnare il file"],
    plan: ["Preparare il talk", "Ripassare la patente", "Andare a correre"],
    steps: ["Raccogliere le fonti", "Scrivere la scaletta", "Preparare le slide", "Provare", "Inviare al team"],
    delegate: ["Prenotare la sala", "Chiedere preventivo"],
    someday: ["Ordinare le foto", "Sistemare il garage"],
    person: "Giulia",
    dictated: "Consegnare la pratica del cliente",
  },
  id: {
    do: ["Telepon tukang ledeng", "Bayar tagihan air", "Kirim berkas klien"],
    plan: ["Siapkan presentasi", "Belajar ujian SIM", "Lari pagi"],
    steps: ["Kumpulkan sumber", "Buat kerangka", "Buat slide", "Latihan", "Kirim ke tim"],
    delegate: ["Pesan ruang rapat", "Minta penawaran"],
    someday: ["Rapikan foto", "Bereskan garasi"],
    person: "Sari",
    dictated: "Kirim berkas klien",
  },
  ja: {
    do: ["水道業者に電話", "水道料金を払う", "顧客資料を提出"],
    plan: ["プレゼンの準備", "運転免許の勉強", "ジョギング"],
    steps: ["資料を集める", "構成を作る", "スライドを作る", "リハーサル", "チームに送る"],
    delegate: ["会議室を予約", "見積もりを催促"],
    someday: ["写真を整理", "ガレージを片づける"],
    person: "佐藤さん",
    dictated: "顧客資料を提出",
  },
  ko: {
    do: ["배관공에게 전화", "수도 요금 납부", "고객 자료 제출"],
    plan: ["발표 준비", "운전면허 공부", "조깅하기"],
    steps: ["자료 모으기", "개요 쓰기", "슬라이드 만들기", "리허설", "팀에 보내기"],
    delegate: ["회의실 예약", "견적 재요청"],
    someday: ["사진 정리", "창고 정리"],
    person: "지수 씨",
    dictated: "고객 자료 제출",
  },
  "zh-Hans": {
    do: ["给水管工打电话", "交水费", "提交客户资料"],
    plan: ["准备演讲", "复习驾照考试", "去跑步"],
    steps: ["收集资料", "列出提纲", "制作幻灯片", "彩排", "发给团队"],
    delegate: ["预订会议室", "催一下报价"],
    someday: ["整理照片", "收拾车库"],
    person: "小王",
    dictated: "提交客户资料",
  },
  tr: {
    do: ["Tesisatçıyı ara", "Su faturasını öde", "Dosyayı teslim et"],
    plan: ["Sunumu hazırla", "Ehliyet sınavına çalış", "Koşuya çık"],
    steps: ["Kaynakları topla", "Taslağı yaz", "Slaytları hazırla", "Prova yap", "Ekibe gönder"],
    delegate: ["Toplantı odasını ayırt", "Teklifi takip et"],
    someday: ["Fotoğrafları düzenle", "Garajı topla"],
    person: "Ayşe",
    dictated: "Müşteri dosyasını teslim et",
  },
  hi: {
    do: ["प्लंबर को फ़ोन करो", "पानी का बिल भरो", "क्लाइंट की फ़ाइल जमा करो"],
    plan: ["प्रेज़ेंटेशन तैयार करो", "ड्राइविंग टेस्ट की पढ़ाई", "दौड़ने जाओ"],
    steps: ["स्रोत जुटाओ", "रूपरेखा लिखो", "स्लाइड बनाओ", "अभ्यास करो", "टीम को भेजो"],
    delegate: ["मीटिंग रूम बुक करो", "कोटेशन की याद दिलाओ"],
    someday: ["फ़ोटो छाँटो", "गैराज साफ़ करो"],
    person: "प्रिया",
    dictated: "क्लाइंट की फ़ाइल जमा करो",
  },
  ru: {
    do: ["Позвонить сантехнику", "Оплатить счёт за воду", "Сдать документы"],
    plan: ["Сделать доклад", "Учить ПДД", "Пробежка"],
    steps: ["Собрать источники", "Составить план", "Сделать слайды", "Отрепетировать", "Отправить команде"],
    delegate: ["Забронировать зал", "Напомнить про смету"],
    someday: ["Разобрать фото", "Убраться в гараже"],
    person: "Анна",
    dictated: "Сдать документы клиента",
  },
};

// Fiches et langue de l'app correspondante (es-ES et es-419 partagent les captures)
export const LISTINGS = {
  "fr-FR": "fr",
  "en-US": "en",
  "es-ES": "es",
  "es-419": "es",
  "pt-BR": "pt-BR",
  "de-DE": "de",
  "it-IT": "it",
  id: "id",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "zh-CN": "zh-Hans",
  "tr-TR": "tr",
  "hi-IN": "hi",
  "ru-RU": "ru",
};

const DAY = 24 * 60 * 60 * 1000;
const at = (base, dayOffset, h, m = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Contenu du localStorage d'une langue (clés d'AsyncStorage). plain : sans échéances ni répétitions
// (matrice : des cases lisibles, comme les captures françaises)
// appearance : thème de l'app pendant les captures (« dark » pour les fiches, « light » pour une
// version claire, générée à part)
export function storageFor(language, now = Date.now(), { plain = false, appearance = "dark" } = {}) {
  const s = SAMPLES[language];
  const base = { isDone: false, timerEnd: null, createdAt: now - 3 * DAY, updatedAt: now - DAY, categoryChangedAt: now - DAY, archivedAt: null, snoozedUntil: null, dueAt: null, reminderOffset: null, nagInterval: null, nagRepeat: false, delegatedTo: null, notificationIds: [], completedAt: null, priorityWeek: null, recurrence: null, nextOccurrenceId: null, escalationSkippedFor: null, steps: [], progress: null };
  const task = (id, title, category, extra = {}) => ({ ...base, id, title, category, ...extra });
  // Jour ouvert dans le calendrier : dans 4 jours (au-delà des 48 h de « bientôt urgente » ; s'il
  // tombe le mois suivant, sa case reste visible en bas de la grille)
  const day = 4;
  const steps = s.steps.map((title, i) => ({ id: `s${i}`, title, done: i < 3, doneAt: i < 3 ? now - (3 - i) * DAY : null, day: dayKey(at(now, i - 2, 9)), time: i === 3 ? "18:00" : null }));
  const tasks = [
    task("do1", s.do[0], "UI", { nagInterval: 120, dueAt: at(now, day, 9), delegatedTo: null }),
    task("do2", s.do[1], "UI", { nagInterval: 120, dueAt: at(now, -4, 11) }),
    task("do3", s.do[2], "UI", { nagInterval: 120, dueAt: at(now, 6, 10) }),
    task("plan1", s.plan[0], "INU", { dueAt: at(now, 9, 14), reminderOffset: 1440, steps }),
    task("plan2", s.plan[1], "INU", { dueAt: at(now, day, 14, 30), reminderOffset: 60 }),
    task("plan3", s.plan[2], "INU", { dueAt: at(now, 3, 7, 30), reminderOffset: 0, recurrence: { freq: "weekly", days: [new Date(at(now, 3, 7)).getDay(), (new Date(at(now, 3, 7)).getDay() + 3) % 7], hour: 7, minute: 30 } }),
    task("del1", s.delegate[0], "UDI", { delegatedTo: s.person, nagInterval: 1440, dueAt: at(now, day, 17) }),
    task("del2", s.delegate[1], "UDI", { delegatedTo: s.person, nagInterval: 1440, dueAt: at(now, 12, 10) }),
    task("some1", s.someday[0], "NDNI"),
    task("some2", s.someday[1], "NDNI"),
  ];

  // Journal des fins de tâches : cette semaine (lundi → maintenant) et les 4 précédentes
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = [
    { UI: 4, INU: 6, UDI: 2, NDNI: 1 }, // cette semaine
    { UI: 2, INU: 6, UDI: 2, NDNI: 0 },
    { UI: 2, INU: 5, UDI: 1, NDNI: 1 },
    { UI: 3, INU: 4, UDI: 2, NDNI: 2 },
    { UI: 5, INU: 2, UDI: 1, NDNI: 2 },
  ];
  const entries = [];
  weeks.forEach((counts, w) => {
    const start = monday.getTime() - w * 7 * DAY;
    const end = w === 0 ? now - 60 * 1000 : start + 7 * DAY - 60 * 60 * 1000;
    const list = Object.entries(counts).flatMap(([category, n]) => Array(n).fill(category));
    list.forEach((category, i) => entries.push({ date: Math.round(start + ((i + 0.5) / list.length) * (end - start)), category }));
  });

  const stored = plain ? tasks.map((t) => ({ ...t, dueAt: null, reminderOffset: null, recurrence: null })) : tasks;
  return {
    TASKS_4COLS: JSON.stringify({ schemaVersion: 8, tasks: stored }),
    SETTINGS: JSON.stringify({
      schemaVersion: 1,
      settings: { onboardingDone: true, remindersPromptDone: true, drivePromptDone: true, language, appearance, weeklyReview: true, celebrations: false, quietHoursEnabled: false, firstUseAt: now - 30 * DAY, reviewAskedAt: now },
    }),
    COMPLETION_LOG: JSON.stringify({ schemaVersion: 1, entries }),
    WEEKLY_REVIEW_LOG: JSON.stringify({ schemaVersion: 1, weeks: [] }),
    DRIVE_BACKUP: JSON.stringify({ account: "alex@example.com", autoBackup: true, lastBackupAt: now - 2 * 60 * 60 * 1000, lastHash: "exemple", lastAttemptAt: now - 2 * 60 * 60 * 1000 }),
    // Jour ouvert dans le calendrier
    __calendarDay: dayKey(at(now, day, 12)),
  };
}
