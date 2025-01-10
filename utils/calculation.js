// calculation.js

// Estimate the current interest rate based on original loan details
const estimateCurrentInterestRate = (loanAmount, tenure, monthlyRepayment) => {
  const maxIterations = 100;
  const tolerance = 1e-6;
  let low = 0;
  let high = 1;
  let r = (low + high) / 2;
  const totalPayments = tenure * 12;

  for (let i = 0; i < maxIterations; i++) {
    const estimatedRepayment =
      (loanAmount * (r * Math.pow(1 + r, totalPayments))) /
      (Math.pow(1 + r, totalPayments) - 1);

    if (Math.abs(estimatedRepayment - monthlyRepayment) < tolerance) {
      return r * 12 * 100; // Convert monthly fraction to annual %
    }

    if (estimatedRepayment > monthlyRepayment) {
      high = r;
    } else {
      low = r;
    }

    r = (low + high) / 2;
  }

  console.warn('Failed to converge on an interest rate.');
  return null;
};

/**
 * Hardcode rates for Path A:
 *  - If loanAmount < 300k => 4.05%
 *  - Otherwise => 3.8%
 */
const performPathACalculation = async (loanAmount, tenure, userInterestRate) => {
  try {
    if (!loanAmount || !tenure || !userInterestRate || loanAmount <= 0 || tenure <= 0 || userInterestRate <= 0) {
      throw new Error('Invalid inputs for Path A calculation.');
    }

    // Hardcoded logic for new interest rate
    let newInterestRate;
    const bankname = 'OCBC Bank';

    if (loanAmount < 300000) {
      newInterestRate = 4.05;
    } else {
      newInterestRate = 3.8;
    }

    const monthlyRateNew = newInterestRate / 100 / 12;
    const totalPayments = tenure * 12;

    // Calculate new monthly repayment
    const newMonthlyRepayment =
      monthlyRateNew === 0
        ? loanAmount / totalPayments
        : (loanAmount * (monthlyRateNew * Math.pow(1 + monthlyRateNew, totalPayments))) /
          (Math.pow(1 + monthlyRateNew, totalPayments) - 1);

    // Simulate current repayment based on user's provided interest rate
    const monthlyRateCurrent = userInterestRate / 100 / 12;
    const currentMonthlyRepayment =
      monthlyRateCurrent === 0
        ? loanAmount / totalPayments
        : (loanAmount * (monthlyRateCurrent * Math.pow(1 + monthlyRateCurrent, totalPayments))) /
          (Math.pow(1 + monthlyRateCurrent, totalPayments) - 1);

    // Calculate savings
    const monthlySavings = currentMonthlyRepayment - newMonthlyRepayment;
    const yearlySavings = monthlySavings * 12;
    const lifetimeSavings = yearlySavings * tenure;

    return {
      // Key savings data
      monthlySavings: parseFloat(monthlySavings.toFixed(2)),
      yearlySavings: parseFloat(yearlySavings.toFixed(2)),
      lifetimeSavings: parseFloat(lifetimeSavings.toFixed(2)),

      // New loan terms
      newMonthlyRepayment: parseFloat(newMonthlyRepayment.toFixed(2)),
      newInterestRate: parseFloat(newInterestRate.toFixed(2)),
      bankname,

      // Return the user's current repayment for display
      currentRepayment: parseFloat(currentMonthlyRepayment.toFixed(2)),
    };
  } catch (error) {
    console.error(`Error in Path A calculation: ${error.message}`);
    return {
      monthlySavings: 0,
      yearlySavings: 0,
      lifetimeSavings: 0,
      newMonthlyRepayment: 0,
      newInterestRate: 0,
      bankname: 'N/A',
      currentRepayment: 0,
    };
  }
};

/**
 * Calculate outstanding balance based on original loan details
 * using a binary search to approximate the user's current interest rate
 */
const calculateOutstandingBalance = (originalLoanAmount, originalTenure, monthlyPayment, yearsPaid) => {
  const estimatedRate = estimateCurrentInterestRate(originalLoanAmount, originalTenure, monthlyPayment);
  if (estimatedRate === null) {
    console.error('Unable to estimate the current interest rate.');
    return null;
  }

  const r = estimatedRate / 100 / 12; // monthly interest fraction
  const totalPayments = originalTenure * 12;
  const paymentsMade = yearsPaid * 12;

  const outstandingBalance =
    originalLoanAmount *
    ((Math.pow(1 + r, totalPayments) - Math.pow(1 + r, paymentsMade)) /
      (Math.pow(1 + r, totalPayments) - 1));

  return {
    outstandingBalance: parseFloat(outstandingBalance.toFixed(2)),
    currentInterestRate: parseFloat(estimatedRate.toFixed(2)),
  };
};

/**
 * Hardcode rates for Path B:
 *  - If outstandingBalance < 300k => 4.05%
 *  - Otherwise => 3.8%
 *  - Bank name: OCBC Bank
 */
const performPathBCalculation = async (
  originalLoanAmount,
  originalTenure,
  monthlyPayment,
  yearsPaid
) => {
  try {
    const outstandingDetails = calculateOutstandingBalance(
      originalLoanAmount,
      originalTenure,
      monthlyPayment,
      yearsPaid
    );

    if (
      !outstandingDetails ||
      isNaN(outstandingDetails.outstandingBalance) ||
      outstandingDetails.outstandingBalance <= 0
    ) {
      throw new Error('Outstanding balance calculation failed or returned invalid value.');
    }

    const { outstandingBalance, currentInterestRate } = outstandingDetails;
    console.log(`Outstanding Balance: ${outstandingBalance}, Current Interest Rate: ${currentInterestRate}`);

    let newInterestRate;
    const bankname = 'OCBC Bank';

    // Hardcoded logic
    if (outstandingBalance < 300000) {
      newInterestRate = 4.05;
    } else {
      newInterestRate = 3.8;
    }

    console.log(`Selected Hardcoded Rate: ${newInterestRate}% for outstanding balance: ${outstandingBalance}`);

    const monthlyRateNew = newInterestRate / 100 / 12;
    const totalPayments = (originalTenure - yearsPaid) * 12;

    if (monthlyRateNew < 0 || totalPayments <= 0) {
      throw new Error('Invalid repayment calculation inputs.');
    }

    const newMonthlyRepayment =
      monthlyRateNew === 0
        ? outstandingBalance / totalPayments
        : (outstandingBalance * (monthlyRateNew * Math.pow(1 + monthlyRateNew, totalPayments))) /
          (Math.pow(1 + monthlyRateNew, totalPayments) - 1);

    const monthlySavings = monthlyPayment - newMonthlyRepayment;
    const yearlySavings = monthlySavings * 12;
    const lifetimeSavings = yearlySavings * (originalTenure - yearsPaid);

    console.log(
      `Calculated Savings - Monthly: ${monthlySavings.toFixed(2)}, Lifetime: ${lifetimeSavings.toFixed(2)}`
    );

    // If you want to proceed even if lifetimeSavings < 10000, remove/modify logic below:
    if (monthlySavings <= 0 || lifetimeSavings < 10000) {
      console.log(
        `Savings too low to proceed: Monthly Savings=${monthlySavings}, Total Savings=${lifetimeSavings}`
      );
      return {
        monthlySavings: 0,
        yearlySavings: 0,
        lifetimeSavings: 0,
        newMonthlyRepayment: 0,
        newInterestRate: 0,
        bankname: 'N/A',
        outstandingBalance,
        currentInterestRate,

        // Return the user’s “currentRepayment” from monthlyPayment
        // so you can see it in your final results
        currentRepayment: parseFloat(monthlyPayment.toFixed(2)),
      };
    }

    return {
      monthlySavings: parseFloat(monthlySavings.toFixed(2)),
      yearlySavings: parseFloat(yearlySavings.toFixed(2)),
      lifetimeSavings: parseFloat(lifetimeSavings.toFixed(2)),
      newMonthlyRepayment: parseFloat(newMonthlyRepayment.toFixed(2)),
      newInterestRate: parseFloat(newInterestRate.toFixed(2)),
      bankname,
      outstandingBalance,
      currentInterestRate,

      // We can also return the user’s monthlyPayment as “currentRepayment”
      currentRepayment: parseFloat(monthlyPayment.toFixed(2)),
    };
  } catch (error) {
    console.error(`Error in Path B calculation: ${error.message}`);
    return {
      monthlySavings: 0,
      yearlySavings: 0,
      lifetimeSavings: 0,
      newMonthlyRepayment: 0,
      newInterestRate: 0,
      bankname: 'N/A',
      outstandingBalance: 0,
      currentInterestRate: 'N/A',
      currentRepayment: 0,
    };
  }
};

module.exports = {
  performPathACalculation,
  performPathBCalculation,
};
