const MESSAGES = {
  WELCOME: {
    en: 'Welcome! **Discover your potential savings** by refinancing your housing loan.\n\nPlease select your preferred language:\n1️⃣ **English**\n2️⃣ **Bahasa Malaysia**\n3️⃣ **Chinese**',
    ms: 'Selamat datang! **Terokai potensi penjimatan** anda melalui pembiayaan semula pinjaman perumahan.\n\nSila pilih bahasa pilihan anda:\n1️⃣ **Inggeris**\n2️⃣ **Bahasa Malaysia**\n3️⃣ **Cina**',
    zh: '欢迎！**探索您的潜在节省**，通过再融资优化您的房屋贷款。\n\n请选择您偏好的语言：\n1️⃣ **英语**\n2️⃣ **马来语**\n3️⃣ **中文**',
  },
  INVALID_INPUT: {
    en: '**Invalid input.** Please try again.',
    ms: '**Input tidak sah.** Sila cuba lagi.',
    zh: '**输入无效。** 请再试一次。',
  },
  ASK_NAME: {
    en: '*Please provide your full name to continue.*\n_Example: John Doe_',
    ms: '*Sila nyatakan nama penuh anda untuk meneruskan.*\n_Contoh: John Doe_',
    zh: '*请提供您的全名以继续。*\n_例如：John Doe_',
  },
  ASK_LOAN_DETAILS: {
    en: '*Do you have your current loan details available?*\n1️⃣ **Yes**\n2️⃣ **No**\n*These details include your loan amount, remaining tenure, and monthly repayment amount.*',
    ms: '*Adakah anda mempunyai butiran pinjaman semasa anda?*\n1️⃣ **Ya**\n2️⃣ **Tidak**\n*Butiran ini termasuk jumlah pinjaman, baki tempoh, dan bayaran balik bulanan.*',
    zh: '*您是否具备当前贷款详情？*\n1️⃣ **是**\n2️⃣ **否**\n*详情包括贷款金额、剩余期限及每月还款金额。*',
  },
  // Path A Prompts
  PATH_A_LOAN_AMOUNT: {
    en: '*Please enter your current outstanding loan amount.*\n_Example: 300000 for RM300,000_',
    ms: '*Sila masukkan jumlah pinjaman tertunggak anda.*\n_Contoh: 300000 untuk RM300,000_',
    zh: '*请输入您当前的未偿贷款金额。*\n_例如：300000 表示 RM300,000_',
  },
  PATH_A_TENURE: {
    en: '*Please provide your remaining loan tenure (in years).* \n_Example: 20_',
    ms: '*Sila nyatakan baki tempoh pinjaman anda (dalam tahun).* \n_Contoh: 20_',
    zh: '*请输入您的剩余贷款期限（以年为单位）。*\n_例如：20_',
  },
  PATH_A_INTEREST_RATE: {
    en: '*Please enter your current interest rate (%).* \n_Example: 4.5_',
    ms: '*Sila masukkan kadar faedah semasa anda (%).* \n_Contoh: 4.5_',
    zh: '*请输入您当前的利率（%）。*\n_例如：4.5_',
  },
  // Path B Prompts
  PATH_B_ORIGINAL_LOAN_AMOUNT: {
    en: '*Please enter your original loan amount.*\n_Example: 450000 for RM450,000_',
    ms: '*Sila masukkan jumlah pinjaman asal anda.*\n_Contoh: 450000 untuk RM450,000_',
    zh: '*请输入您的原始贷款金额。*\n_例如：450000 表示 RM450,000_',
  },
  PATH_B_ORIGINAL_TENURE: {
    en: '*Please enter your original loan tenure (in years).* \n_Example: 25_',
    ms: '*Sila nyatakan tempoh pinjaman asal anda (dalam tahun).* \n_Contoh: 25_',
    zh: '*请输入您的原始贷款期限（以年为单位）。*\n_例如：25_',
  },
  PATH_B_MONTHLY_PAYMENT: {
    en: '*Please enter your current monthly repayment amount.*\n_Example: 2200 for RM2,200_',
    ms: '*Sila masukkan jumlah bayaran balik bulanan semasa anda.*\n_Contoh: 2200 untuk RM2,200_',
    zh: '*请输入您当前的每月还款金额。*\n_例如：2200 表示 RM2,200_',
  },
  PATH_B_YEARS_PAID: {
    en: '*Please specify how many years you have been repaying this loan.*\n_Example: 5_',
    ms: '*Sila nyatakan berapa tahun anda telah membayar pinjaman ini.*\n_Contoh: 5_',
    zh: '*请问您已经还款多少年了？*\n_例如：5_',
  },
  // Summary Message
  SUMMARY: {
    en: '*Your Personalized Refinancing Summary:*\n- **Monthly Savings**: {monthlySavings}\n- **Yearly Savings**: {yearlySavings}\n- **Total Savings**: {totalSavings}\n- **New Monthly Repayment**: {newMonthlyRepayment}\n- **Bank**: {bankname} (*Interest Rate*: {interestRate}%)',
    ms: '*Ringkasan Pembiayaan Semula Anda:*\n- **Penjimatan Bulanan**: {monthlySavings}\n- **Penjimatan Tahunan**: {yearlySavings}\n- **Jumlah Penjimatan**: {totalSavings}\n- **Bayaran Bulanan Baharu**: {newMonthlyRepayment}\n- **Bank**: {bankname} (*Kadar Faedah*: {interestRate}%)',
    zh: '*您的再融资摘要：*\n- **每月节省**：{monthlySavings}\n- **每年节省**：{yearlySavings}\n- **总节省**：{totalSavings}\n- **新的每月还款额**：{newMonthlyRepayment}\n- **银行**：{bankname}（*利率*：{interestRate}%）',
  },
  CONTACT_ADMIN: {
    en: '*Need further assistance?* Please contact our specialist: [Chat with us](https://wa.me/60126181683)',
    ms: '*Perlukan bantuan lanjut?* Sila hubungi pakar kami: [Hubungi kami](https://wa.me/60126181683)',
    zh: '*需要进一步帮助？* 请联系专员：[联系我们](https://wa.me/60126181683)',
  },
};

const SUMMARY_TRANSLATIONS = {
  en: {
    header: 'Your Personalized Refinancing Summary:',
    monthlySavings: 'Monthly Savings',
    yearlySavings: 'Yearly Savings',
    totalSavings: 'Total Savings',
    newRepayment: 'New Monthly Repayment',
    bank: 'Bank',
    interestRate: 'Interest Rate',
    analysis: 'Our AI are reviewing your details to determine the refinancing benefits.',
  },
  ms: {
    header: 'Ringkasan Pembiayaan Semula Anda:',
    monthlySavings: 'Penjimatan Bulanan',
    yearlySavings: 'Penjimatan Tahunan',
    totalSavings: 'Jumlah Penjimatan',
    newRepayment: 'Bayaran Bulanan Baharu',
    bank: 'Bank',
    interestRate: 'Kadar Faedah',
    analysis: 'AI kami sedang menyemak butiran anda untuk menentukan manfaat pembiayaan semula.',
  },
  zh: {
    header: '您的再融资摘要：',
    monthlySavings: '每月节省',
    yearlySavings: '每年节省',
    totalSavings: '总节省',
    newRepayment: '新的每月还款额',
    bank: '银行',
    interestRate: '利率',
    analysis: '我们的专家正在审核您的详情，以确定再融资的优势。',
  },
};

module.exports = {
  MESSAGES,
  SUMMARY_TRANSLATIONS,
};
