import { Investment, Transaction, PortfolioState } from '../types';

const STORAGE_KEY = 'smart_portfolio_state';

const INITIAL_STATE: PortfolioState = {
  availableFunds: 100000, // Starting with 1 Lakh demo funds
  investments: [],
  transactions: [],
  alerts: [],
  sentiments: {}
};

/**
 * Service for managing portfolio state in local storage.
 */
export const investmentService = {
  /**
   * Fetches the full portfolio state.
   */
  getState: (): PortfolioState => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
    return {
      availableFunds: 100000,
      investments: [],
      transactions: [],
      alerts: [],
      sentiments: {}
    };
  },

  /**
   * Saves the full portfolio state.
   */
  saveState: (state: PortfolioState) => {
    // Check for alerts before saving
    const updatedState = investmentService.checkRiskAlerts(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
  },

  /**
   * Calculates risk level for an investment.
   */
  getRiskLevel: (investment: Investment) => {
    if (investment.type === 'Stock') {
      if (investment.sector === 'IT' || investment.sector === 'Other') return 'High';
      if (investment.sector === 'Banking' || investment.sector === 'Energy') return 'Medium';
      return 'Low';
    }
    return 'Low';
  },

  /**
   * Checks for risk violations and generates alerts.
   */
  checkRiskAlerts: (state: PortfolioState): PortfolioState => {
    const riskMap = { 'Low': 1, 'Medium': 2, 'High': 3 };
    const newAlerts = [...state.alerts];

    state.investments.forEach(inv => {
      let currentRisk = investmentService.getRiskLevel(inv);
      
      // Incorporate sentiment into risk assessment
      const sentiment = state.sentiments[inv.name];
      if (sentiment && sentiment.overallSentiment === 'Negative') {
        // Elevate risk if sentiment is negative
        if (currentRisk === 'Low') currentRisk = 'Medium';
        else if (currentRisk === 'Medium') currentRisk = 'High';
      }

      if (inv.riskThreshold) {
        if (riskMap[currentRisk] > riskMap[inv.riskThreshold]) {
          // Check if alert already exists for this investment and risk level
          const alertExists = newAlerts.some(a => 
            a.investmentId === inv.id && 
            a.type === 'RISK_EXCEEDED' && 
            !a.isRead
          );

          if (!alertExists) {
            newAlerts.unshift({
              id: Math.random().toString(36).substr(2, 9),
              investmentId: inv.id,
              assetName: inv.name,
              type: 'RISK_EXCEEDED',
              message: `Risk level (${currentRisk}) exceeds your threshold (${inv.riskThreshold}) for ${inv.name}.`,
              date: new Date().toISOString(),
              isRead: false
            });
          }
        }
      }
    });

    return { ...state, alerts: newAlerts };
  },

  /**
   * Marks an alert as read.
   */
  markAlertAsRead: (alertId: string) => {
    const state = investmentService.getState();
    const alertIndex = state.alerts.findIndex(a => a.id === alertId);
    if (alertIndex > -1) {
      state.alerts[alertIndex].isRead = true;
      investmentService.saveState(state);
    }
    return state;
  },

  /**
   * Handles buying an asset.
   */
  buyAsset: (investment: Omit<Investment, 'id'>) => {
    const state = investmentService.getState();
    
    // Sanitize inputs
    const quantity = Number(investment.quantity) || 0;
    const buyPrice = Number(investment.buyPrice) || 0;
    const currentPrice = Number(investment.currentPrice) || buyPrice;
    const name = (investment.name || '').trim();
    
    if (!name) throw new Error('Asset name is required.');
    if (quantity <= 0) throw new Error('Quantity must be greater than 0.');
    if (buyPrice <= 0) throw new Error('Buy price must be greater than 0.');

    const totalCost = quantity * buyPrice;

    if (totalCost > state.availableFunds) {
      throw new Error('Insufficient funds to complete this purchase.');
    }

    const id = Math.random().toString(36).substr(2, 9);
    const sanitizedInvestment: Investment = { 
      ...investment, 
      id, 
      name, 
      quantity, 
      buyPrice, 
      currentPrice 
    };
    
    // Update investments (combine if same name/type/sector)
    const existingIndex = state.investments.findIndex(
      i => i.name.toLowerCase() === name.toLowerCase() && i.type === investment.type
    );

    let finalInvestmentId = id;

    if (existingIndex > -1) {
      const existing = state.investments[existingIndex];
      const totalQuantity = existing.quantity + quantity;
      const avgPrice = ((existing.quantity * existing.buyPrice) + (quantity * buyPrice)) / totalQuantity;
      
      finalInvestmentId = existing.id;
      state.investments[existingIndex] = {
        ...existing,
        quantity: totalQuantity,
        buyPrice: avgPrice,
        currentPrice: currentPrice // Update to latest price
      };
    } else {
      state.investments.push(sanitizedInvestment);
    }

    // Log transaction
    const transaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      investmentId: finalInvestmentId,
      assetName: name,
      type: 'BUY',
      quantity: quantity,
      price: buyPrice,
      totalAmount: totalCost,
      date: new Date().toISOString()
    };
    state.transactions.unshift(transaction);

    // Deduct funds
    state.availableFunds -= totalCost;

    investmentService.saveState(state);
    return state;
  },

  /**
   * Updates an existing investment and adjusts funds if necessary.
   */
  updateAsset: (id: string, updatedInvestment: Investment) => {
    const state = investmentService.getState();
    const index = state.investments.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Investment not found.');

    // Sanitize inputs
    const quantity = Number(updatedInvestment.quantity) || 0;
    const buyPrice = Number(updatedInvestment.buyPrice) || 0;
    const currentPrice = Number(updatedInvestment.currentPrice) || buyPrice;
    const name = (updatedInvestment.name || '').trim();

    if (!name) throw new Error('Asset name is required.');
    if (quantity <= 0) throw new Error('Quantity must be greater than 0.');
    if (buyPrice <= 0) throw new Error('Buy price must be greater than 0.');

    const original = state.investments[index];
    const originalCost = original.quantity * original.buyPrice;
    const newCost = quantity * buyPrice;
    const costDiff = newCost - originalCost;

    if (costDiff > state.availableFunds) {
      throw new Error('Insufficient funds to cover the increased investment cost.');
    }

    // Update investment
    state.investments[index] = { 
      ...updatedInvestment, 
      id, 
      name, 
      quantity, 
      buyPrice, 
      currentPrice 
    };

    // Deduct/Add funds
    state.availableFunds -= costDiff;

    // Log transaction if cost changed significantly
    if (Math.abs(costDiff) > 0.01) {
      const transaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        investmentId: id,
        assetName: name,
        type: costDiff > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(quantity - original.quantity),
        price: buyPrice,
        totalAmount: Math.abs(costDiff),
        date: new Date().toISOString()
      };
      state.transactions.unshift(transaction);
    }

    investmentService.saveState(state);
    return state;
  },

  /**
   * Handles selling an asset.
   */
  sellAsset: (id: string, quantity: number, sellPrice: number) => {
    const state = investmentService.getState();
    const index = state.investments.findIndex(i => i.id === id);

    if (index === -1) throw new Error('Investment not found.');
    const investment = state.investments[index];

    if (quantity > investment.quantity) {
      throw new Error('Cannot sell more units than you own.');
    }

    const totalProceeds = quantity * sellPrice;

    // Update or remove investment
    if (quantity === investment.quantity) {
      state.investments.splice(index, 1);
    } else {
      state.investments[index].quantity -= quantity;
    }

    // Log transaction
    const transaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      investmentId: id,
      assetName: investment.name,
      type: 'SELL',
      quantity,
      price: sellPrice,
      buyPrice: investment.buyPrice, // Store cost basis
      totalAmount: totalProceeds,
      date: new Date().toISOString()
    };
    state.transactions.unshift(transaction);

    // Add to funds
    state.availableFunds += totalProceeds;

    investmentService.saveState(state);
    return state;
  },

  /**
   * Updates the current price of an asset and records it in history.
   */
  updatePrice: (id: string, newPrice: number, date: string) => {
    const state = investmentService.getState();
    const index = state.investments.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Investment not found.');

    const investment = state.investments[index];
    investment.currentPrice = newPrice;
    
    if (!investment.priceHistory) {
      investment.priceHistory = [];
    }

    // Check if date already exists in history (comparing only the date part)
    const dateKey = date.split('T')[0];
    const historyIndex = investment.priceHistory.findIndex(p => p.date.split('T')[0] === dateKey);
    
    if (historyIndex > -1) {
      investment.priceHistory[historyIndex].price = newPrice;
    } else {
      investment.priceHistory.push({ date, price: newPrice });
    }
    
    // Sort history by date
    investment.priceHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    investmentService.saveState(state);
    return state;
  },

  /**
   * Adds funds to the portfolio.
   */
  addFunds: (amount: number) => {
    const state = investmentService.getState();
    state.availableFunds += amount;

    // Log transaction
    const transaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      assetName: 'Cash Deposit',
      type: 'DEPOSIT',
      totalAmount: amount,
      date: new Date().toISOString()
    };
    state.transactions.unshift(transaction);

    investmentService.saveState(state);
    return state;
  },

  /**
   * Withdraws funds from the portfolio.
   */
  withdrawFunds: (amount: number) => {
    const state = investmentService.getState();
    if (amount > state.availableFunds) {
      throw new Error('Insufficient funds for withdrawal.');
    }
    state.availableFunds -= amount;

    // Log transaction
    const transaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      assetName: 'Cash Withdrawal',
      type: 'WITHDRAW',
      totalAmount: amount,
      date: new Date().toISOString()
    };
    state.transactions.unshift(transaction);

    investmentService.saveState(state);
    return state;
  },

  /**
   * Seeds the local storage with demo data if empty.
   */
  seedDemoData: () => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      const demoInvestments: Investment[] = [
        {
          id: '1',
          type: 'Stock',
          name: 'HDFC Bank',
          sector: 'Banking',
          quantity: 10,
          buyPrice: 1450,
          currentPrice: 1680,
          date: '2024-01-15'
        },
        {
          id: '2',
          type: 'Stock',
          name: 'TCS',
          sector: 'IT',
          quantity: 5,
          buyPrice: 3200,
          currentPrice: 4100,
          date: '2023-11-20'
        }
      ];

      const demoTransactions: Transaction[] = demoInvestments.map(inv => ({
        id: Math.random().toString(36).substr(2, 9),
        investmentId: inv.id,
        assetName: inv.name,
        type: 'BUY',
        quantity: inv.quantity,
        price: inv.buyPrice,
        totalAmount: inv.quantity * inv.buyPrice,
        date: inv.date + 'T10:00:00.000Z'
      }));

      const totalInvested = demoInvestments.reduce((acc, inv) => acc + (inv.quantity * inv.buyPrice), 0);

      const initialDeposit: Transaction = {
        id: 'initial-deposit',
        assetName: 'Initial Capital',
        type: 'DEPOSIT',
        totalAmount: 100000,
        date: '2023-11-01T09:00:00.000Z'
      };

      const demoState: PortfolioState = {
        availableFunds: 100000 - totalInvested,
        investments: demoInvestments,
        transactions: [initialDeposit, ...demoTransactions],
        alerts: [],
        sentiments: {}
      };
      
      investmentService.saveState(demoState);
    }
  }
};
