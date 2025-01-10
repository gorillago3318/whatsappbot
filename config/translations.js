const MESSAGES = {
  WELCOME: {
    en: 'Discover how much you could potentially save on your housing loan.\n1️⃣ *English*\n2️⃣ *Bahasa Malaysia*\n3️⃣ *Chinese*',
    ms: 'Ketahui berapa banyak anda boleh jimatkan daripada pinjaman perumahan anda.\n1️⃣ *Inggeris*\n2️⃣ *Bahasa Malaysia*\n3️⃣ *Cina*',
    zh: '想知道您在贷款上可节省多少吗？\n1️⃣ *英语*\n2️⃣ *马来语*\n3️⃣ *中文*',
  },
  INVALID_INPUT: {
    en: '*Invalid input.* Please try again.',
    ms: '*Input tidak sah.* Sila cuba lagi.',
    zh: '*输入无效。* 请再试一次。',
  },
  ASK_NAME: {
    en: "*What's your name?*\n_Example: John Doe_",
    ms: '*Siapa nama anda?*\n_Contoh: John Doe_',
    zh: '*你的名字是什么？*\n_例如：John Doe_',
  },
  ASK_LOAN_DETAILS: {
    en: '*Do you know your outstanding loan details?*\n1️⃣ *Yes*\n2️⃣ *No*\n_This includes information like loan amount, tenure, and monthly repayment._',
    ms: '*Adakah anda tahu butiran pinjaman tertunggak anda?\n1️⃣ *Ya*\n2️⃣ *Tidak*\n_Ini termasuk maklumat seperti jumlah pinjaman, tempoh, dan bayaran balik bulanan._',
    zh: '*您知道您的未偿贷款详细信息吗？*\n1️⃣ *是*\n2️⃣ *否*\n_这包括贷款金额、期限和每月还款等信息。_',
  },
  // Path A Prompts
  PATH_A_LOAN_AMOUNT: {
    en: '*What is your outstanding loan amount?*\n_Example: 300000 for RM300,000_',
    ms: '*Apakah jumlah pinjaman tertunggak anda?*\n_Contoh: 300000 untuk RM300,000_',
    zh: '*您的未偿还贷款金额是多少？*\n_例如：300000 表示 RM300,000_',
  },
  PATH_A_TENURE: {
    en: '*What is your loan tenure in years?*\n_Example: 20 for 20 years_',
    ms: '*Apakah tempoh pinjaman anda dalam tahun?*\n_Contoh: 20 untuk 20 tahun_',
    zh: '*您的贷款期限是多少年？*\n_例如：20 表示 20 年_',
  },
  PATH_A_INTEREST_RATE: {
    en: '*What is your current interest rate?*\n_Example: 4.5 for 4.5%_',
    ms: '*Apakah kadar faedah semasa anda?*\n_Contoh: 4.5 untuk 4.5%_',
    zh: '*您当前的利率是多少？*\n_例如：4.5 表示 4.5%_',
  },
  // Path B Prompts
  PATH_B_ORIGINAL_LOAN_AMOUNT: {
    en: '*What was your original loan amount?*\n_Example: 450000 for RM450,000_',
    ms: '*Apakah jumlah pinjaman asal anda?*\n_Contoh: 450000 untuk RM450,000_',
    zh: '*您的原始贷款金额是多少？*\n_例如：450000 表示 RM450,000_',
  },
  PATH_B_ORIGINAL_TENURE: {
    en: '*What was your original loan tenure in years?*\n_Example: 25 for 25 years_',
    ms: '*Apakah tempoh pinjaman asal anda dalam tahun?*\n_Contoh: 25 untuk 25 tahun_',
    zh: '*您的原始贷款期限是多少年？*\n_例如：25 表示 25 年_',
  },
  PATH_B_MONTHLY_PAYMENT: {
    en: '*What is your current monthly repayment?*\n_Example: 2200 for RM2,200_',
    ms: '*Apakah bayaran balik bulanan anda sekarang?*\n_Contoh: 2200 untuk RM2,200_',
    zh: '*您当前的每月还款额是多少？*\n_例如：2200 表示 RM2,200_',
  },
  PATH_B_YEARS_PAID: {
    en: '*How many years have you been paying this loan?*\n_Example: 5 for 5 years_',
    ms: '*Anda telah membayar pinjaman ini selama berapa tahun?*\n_Contoh: 5 untuk 5 tahun_',
    zh: '*您已经支付了多少年的贷款？*\n_例如：5 表示 5 年_',
  },
  // Summary Message
  SUMMARY: {
    en: '*Here is your refinancing summary:*\n- *Monthly Savings*: {monthlySavings}\n- *Yearly Savings*: {yearlySavings}\n- *Total Savings*: {totalSavings}\n- *New Monthly Repayment*: {newMonthlyRepayment}\n- *Bank*: {bankname} (*Interest Rate*: {interestRate}%)',
    ms: '*Berikut adalah ringkasan pembiayaan semula anda:*\n- *Penjimatan Bulanan*: {monthlySavings}\n- *Penjimatan Tahunan*: {yearlySavings}\n- *Penjimatan Keseluruhan*: {totalSavings}\n- *Bayaran Bulanan Baharu*: {newMonthlyRepayment}\n- *Bank*: {bankname} (*Kadar Faedah*: {interestRate}%)',
    zh: '*以下是您的再融资摘要：*\n- *每月节省*：{monthlySavings}\n- *每年节省*：{yearlySavings}\n- *总节省*：{totalSavings}\n- *新的每月还款额*：{newMonthlyRepayment}\n- *银行*：{bankname}（*利率*：{interestRate}%）',
  },
  CONTACT_ADMIN: {
    en: '*Need further help?* Contact our admin: https://wa.me/60126181683',
    ms: '*Perlukan bantuan lanjut?* Hubungi pentadbir kami: https://wa.me/60126181683',
    zh: '*需要进一步帮助？* 请联系管理员：https://wa.me/60126181683',
  },
};

const SUMMARY_TRANSLATIONS = {
  en: {
    header: 'Here is your refinancing summary:',
    monthlySavings: 'Monthly Savings',
    yearlySavings: 'Yearly Savings',
    totalSavings: 'Total Savings', // User-facing term
    newRepayment: 'New Monthly Repayment',
    bank: 'Bank',
    interestRate: 'Interest Rate',
    analysis: 'Please hold on while we analyze if refinancing benefits you.',
  },
  ms: {
    header: 'Berikut adalah ringkasan pembiayaan semula anda:',
    monthlySavings: 'Penjimatan Bulanan',
    yearlySavings: 'Penjimatan Tahunan',
    totalSavings: 'Jumlah Penjimatan', // User-facing term
    newRepayment: 'Bayaran Bulanan Baru',
    bank: 'Bank',
    interestRate: 'Kadar Faedah',
    analysis: 'Sila tunggu sementara kami menganalisis sama ada pembiayaan semula memberi manfaat kepada anda.',
  },
  zh: {
    header: '以下是您的再融资摘要：',
    monthlySavings: '每月节省',
    yearlySavings: '每年节省',
    totalSavings: '总节省', // User-facing term
    newRepayment: '新的每月还款',
    bank: '银行',
    interestRate: '利率',
    analysis: '请稍等，我们正在分析再融资是否对您有益。',
  },

};

module.exports = {
  MESSAGES,
  SUMMARY_TRANSLATIONS,
};
