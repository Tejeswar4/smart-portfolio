/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  LayoutDashboard, 
  List, 
  Trash2, 
  Edit2, 
  Eye,
  Filter, 
  ArrowUpDown,
  AlertCircle,
  ChevronRight,
  Download,
  Moon,
  Sun,
  Wallet,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  Check,
  X
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Investment, AssetType, Sector, SECTORS, ASSET_TYPES, PortfolioSummary, Transaction, PortfolioState, RiskLevel, PortfolioValuePoint, AssetSentiment } from './types';
import { investmentService } from './services/investmentService';
import { newsService } from './services/newsService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    availableFunds: 0,
    investments: [],
    transactions: [],
    alerts: [],
    sentiments: {}
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'history' | 'pnl'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isFundsModalOpen, setIsFundsModalOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [selectedAssetNews, setSelectedAssetNews] = useState<AssetSentiment | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingInvestment, setViewingInvestment] = useState<Investment | null>(null);
  const [isRefreshingSentiment, setIsRefreshingSentiment] = useState(false);
  const [fundsAction, setFundsAction] = useState<'add' | 'withdraw'>('add');
  const [fundsAmount, setFundsAmount] = useState<number>(0);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [sellingInvestment, setSellingInvestment] = useState<Investment | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Price Update State
  const [updatePriceValue, setUpdatePriceValue] = useState<number>(0);
  const [updatePriceDate, setUpdatePriceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  
  // Sell Form State
  const [sellQuantity, setSellQuantity] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);

  // Filters and Sort
  const [filterType, setFilterType] = useState<AssetType | 'All'>('All');
  const [filterSector, setFilterSector] = useState<Sector | 'All'>('All');
  const [sortBy, setSortBy] = useState<'return' | 'profit' | 'value'>('return');

  // Form State
  const [formData, setFormData] = useState<Partial<Investment>>({
    type: 'Stock',
    sector: 'Banking',
    quantity: 0,
    buyPrice: 0,
    currentPrice: 0,
    date: new Date().toISOString().split('T')[0],
    riskThreshold: 'High'
  });

  useEffect(() => {
    investmentService.seedDemoData();
    const state = investmentService.getState();
    setPortfolio(state);
    
    // Fetch initial sentiments
    refreshAllSentiments(state.investments);
  }, []);

  const refreshAllSentiments = async (currentInvestments: Investment[], force = false) => {
    setIsRefreshingSentiment(true);
    const names = Array.from(new Set(currentInvestments.map(i => i.name)));
    
    // Always get the latest state from the service to avoid stale closures
    const currentState = investmentService.getState();
    const newSentiments: Record<string, AssetSentiment> = { ...currentState.sentiments };
    
    for (const name of names) {
      if (force || !newSentiments[name]) {
        const sentiment = await newsService.getSentiment(name);
        newSentiments[name] = sentiment;
      }
    }
    
    const newState = { ...currentState, sentiments: newSentiments };
    investmentService.saveState(newState);
    setPortfolio(newState);
    setIsRefreshingSentiment(false);
  };

  const investments = portfolio.investments;

  /**
   * Calculates portfolio-wide metrics including totals, profit/loss, and performers.
   * Runs whenever the investments array changes.
   */
  const summary = useMemo((): PortfolioSummary => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let bestPerformer: Investment | null = null;
    let worstPerformer: Investment | null = null;

    investments.forEach(inv => {
      const invested = inv.quantity * inv.buyPrice;
      const current = inv.quantity * inv.currentPrice;
      const returns = ((inv.currentPrice - inv.buyPrice) / inv.buyPrice) * 100;

      totalInvested += invested;
      totalCurrentValue += current;

      if (!bestPerformer || returns > ((bestPerformer.currentPrice - bestPerformer.buyPrice) / bestPerformer.buyPrice) * 100) {
        bestPerformer = inv;
      }
      if (!worstPerformer || returns < ((worstPerformer.currentPrice - worstPerformer.buyPrice) / worstPerformer.buyPrice) * 100) {
        worstPerformer = inv;
      }
    });

    const realizedProfitLoss = portfolio.transactions
      .filter(tx => tx.type === 'SELL' && tx.buyPrice !== undefined)
      .reduce((acc, tx) => acc + ( (tx.price! - tx.buyPrice!) * tx.quantity! ), 0);

    const unrealizedProfitLoss = (totalCurrentValue - totalInvested);
    const totalProfitLoss = unrealizedProfitLoss + realizedProfitLoss;
    const overallReturnPercentage = totalInvested > 0 ? (unrealizedProfitLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalProfitLoss,
      unrealizedProfitLoss,
      realizedProfitLoss,
      overallReturnPercentage,
      assetCount: investments.length,
      bestPerformer,
      worstPerformer
    };
  }, [investments, portfolio.transactions]);

  /**
   * Filters and sorts the investment list based on user selection.
   * Handles asset type, sector filtering, and multiple sorting criteria.
   */
  const filteredInvestments = useMemo(() => {
    return investments
      .filter(inv => (filterType === 'All' || inv.type === filterType))
      .filter(inv => (filterSector === 'All' || inv.sector === filterSector))
      .sort((a, b) => {
        if (sortBy === 'return') {
          const retA = ((a.currentPrice - a.buyPrice) / a.buyPrice);
          const retB = ((b.currentPrice - b.buyPrice) / b.buyPrice);
          return retB - retA;
        }
        if (sortBy === 'profit') {
          return (b.quantity * (b.currentPrice - b.buyPrice)) - (a.quantity * (a.currentPrice - a.buyPrice));
        }
        return (b.quantity * b.currentPrice) - (a.quantity * a.currentPrice);
      });
  }, [investments, filterType, filterSector, sortBy]);

  /**
   * Prepares data for Recharts visualization.
   * Aggregates value by sector and identifies top profit contributors.
   */
  const chartData = useMemo(() => {
    const sectorData: Record<string, number> = {};
    investments.forEach(inv => {
      sectorData[inv.sector] = (sectorData[inv.sector] || 0) + (inv.quantity * inv.currentPrice);
    });

    const pieData = Object.entries(sectorData).map(([name, value]) => ({ name, value }));

    const barData = investments.map(inv => ({
      name: inv.name,
      profit: inv.quantity * (inv.currentPrice - inv.buyPrice)
    })).sort((a, b) => b.profit - a.profit).slice(0, 5);

    // Calculate historyData and P&L history
    const transactions = [...portfolio.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Collect all unique dates from transactions and price histories
    const allDates = new Set<string>();
    transactions.forEach(tx => allDates.add(tx.date.split('T')[0]));
    investments.forEach(inv => {
      if (inv.priceHistory) {
        inv.priceHistory.forEach(p => allDates.add(p.date.split('T')[0]));
      }
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    let currentFunds = 0;
    let realizedPnL = 0;
    const holdings: Record<string, { quantity: number, avgBuyPrice: number, lastPrice: number }> = {};
    const historyPoints: PortfolioValuePoint[] = [];
    const pnlHistory: any[] = [];

    // Group transactions by date
    const transactionsByDate: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
      const dateKey = tx.date.split('T')[0];
      if (!transactionsByDate[dateKey]) transactionsByDate[dateKey] = [];
      transactionsByDate[dateKey].push(tx);
    });

    // Group price history by date and asset
    const priceHistoryByDate: Record<string, Record<string, number>> = {};
    investments.forEach(inv => {
      if (inv.priceHistory) {
        inv.priceHistory.forEach(p => {
          const dateKey = p.date.split('T')[0];
          if (!priceHistoryByDate[dateKey]) priceHistoryByDate[dateKey] = {};
          priceHistoryByDate[dateKey][inv.name] = p.price;
        });
      }
    });

    sortedDates.forEach(date => {
      // 1. Update prices from history for this date
      if (priceHistoryByDate[date]) {
        Object.entries(priceHistoryByDate[date]).forEach(([assetName, price]) => {
          if (holdings[assetName]) {
            holdings[assetName].lastPrice = price;
          }
        });
      }

      // 2. Process transactions for this date
      const dayTxs = transactionsByDate[date] || [];
      dayTxs.forEach(tx => {
        if (tx.type === 'DEPOSIT') currentFunds += tx.totalAmount;
        if (tx.type === 'WITHDRAW') currentFunds -= tx.totalAmount;
        if (tx.type === 'BUY') {
          currentFunds -= tx.totalAmount;
          const key = tx.assetName;
          if (!holdings[key]) holdings[key] = { quantity: 0, avgBuyPrice: 0, lastPrice: 0 };
          
          const qty = tx.quantity || 0;
          const price = tx.price || 0;
          const totalCost = (holdings[key].quantity * holdings[key].avgBuyPrice) + (qty * price);
          
          holdings[key].quantity += qty;
          if (holdings[key].quantity > 0) {
            holdings[key].avgBuyPrice = totalCost / holdings[key].quantity;
          }
          holdings[key].lastPrice = price;
        }
        if (tx.type === 'SELL') {
          currentFunds += tx.totalAmount;
          const key = tx.assetName;
          if (holdings[key]) {
            const qty = tx.quantity || 0;
            const price = tx.price || 0;
            const buyPrice = tx.buyPrice || holdings[key].avgBuyPrice;
            
            const profit = (price - buyPrice) * qty;
            realizedPnL += profit;
            
            holdings[key].quantity -= qty;
            holdings[key].lastPrice = price;
            if (holdings[key].quantity <= 0) delete holdings[key];
          }
        }
      });

      const holdingsValue = Object.values(holdings).reduce((acc, h) => acc + (h.quantity * h.lastPrice), 0);
      const unrealizedPnL = Object.values(holdings).reduce((acc, h) => acc + (h.quantity * (h.lastPrice - h.avgBuyPrice)), 0);
      
      const dateLabel = format(new Date(date), 'dd MMM');
      
      historyPoints.push({
        date: dateLabel,
        value: Math.round(currentFunds + holdingsValue)
      });

      pnlHistory.push({
        date: dateLabel,
        realized: Math.round(realizedPnL),
        unrealized: Math.round(unrealizedPnL),
        total: Math.round(realizedPnL + unrealizedPnL)
      });
    });

    // Add current day if not already present
    const today = new Date().toISOString().split('T')[0];
    if (sortedDates.length === 0 || sortedDates[sortedDates.length - 1] !== today) {
      // Update prices to current prices
      investments.forEach(inv => {
        if (holdings[inv.name]) {
          holdings[inv.name].lastPrice = inv.currentPrice;
        }
      });

      const holdingsValue = Object.values(holdings).reduce((acc, h) => acc + (h.quantity * h.lastPrice), 0);
      const unrealizedPnL = Object.values(holdings).reduce((acc, h) => acc + (h.quantity * (h.lastPrice - h.avgBuyPrice)), 0);
      
      const dateLabel = format(new Date(today), 'dd MMM');
      
      historyPoints.push({
        date: dateLabel,
        value: Math.round(portfolio.availableFunds + holdingsValue)
      });

      pnlHistory.push({
        date: dateLabel,
        realized: Math.round(realizedPnL),
        unrealized: Math.round(unrealizedPnL),
        total: Math.round(realizedPnL + unrealizedPnL)
      });
    }

    return { pieData, barData, historyPoints, pnlHistory };
  }, [portfolio, investments]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  /**
   * Handles the submission of the add/edit investment form.
   * Updates local storage and refreshes the UI state.
   */
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Asset name is required.');
      return;
    }
    try {
      if (editingInvestment) {
        const newState = investmentService.updateAsset(editingInvestment.id, formData as Investment);
        setPortfolio(newState);
        refreshAllSentiments(newState.investments);
      } else {
        const newState = investmentService.buyAsset(formData as Investment);
        setPortfolio(newState);
        refreshAllSentiments(newState.investments);
      }
      
      setIsModalOpen(false);
      setEditingInvestment(null);
      setFormData({
        type: 'Stock',
        sector: 'Banking',
        quantity: 0,
        buyPrice: 0,
        currentPrice: 0,
        date: new Date().toISOString().split('T')[0],
        riskThreshold: 'High'
      });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSellClick = (inv: Investment) => {
    setSellingInvestment(inv);
    setSellQuantity(inv.quantity);
    setSellPrice(inv.currentPrice);
    setIsSellModalOpen(true);
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingInvestment) return;
    
    try {
      const newState = investmentService.sellAsset(sellingInvestment.id, sellQuantity, sellPrice);
      setPortfolio(newState);
      setIsSellModalOpen(false);
      setSellingInvestment(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdatePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingInvestment) return;

    try {
      const newState = investmentService.updatePrice(viewingInvestment.id, updatePriceValue, updatePriceDate + 'T12:00:00.000Z');
      setPortfolio(newState);
      setViewingInvestment(newState.investments.find(i => i.id === viewingInvestment.id) || null);
      setIsUpdatingPrice(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleFundsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fundsAmount <= 0) return;

    try {
      let newState;
      if (fundsAction === 'add') {
        newState = investmentService.addFunds(fundsAmount);
      } else {
        newState = investmentService.withdrawFunds(fundsAmount);
      }
      setPortfolio(newState);
      setIsFundsModalOpen(false);
      setFundsAmount(0);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleMarkAsRead = (id: string) => {
    const newState = investmentService.markAlertAsRead(id);
    setPortfolio(newState);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      const investmentToDelete = portfolio.investments.find(i => i.id === deleteConfirmId);
      if (investmentToDelete) {
        const investedAmount = investmentToDelete.quantity * investmentToDelete.buyPrice;
        const newState = { 
          ...portfolio, 
          availableFunds: portfolio.availableFunds + investedAmount,
          investments: portfolio.investments.filter(i => i.id !== deleteConfirmId) 
        };
        investmentService.saveState(newState);
        setPortfolio(newState);
      }
      setDeleteConfirmId(null);
    }
  };

  const unreadAlertsCount = portfolio.alerts?.filter(a => !a.isRead).length || 0;

  const handleViewDetails = (inv: Investment) => {
    setViewingInvestment(inv);
    setIsViewModalOpen(true);
  };
  const handleEdit = (inv: Investment) => {
    setEditingInvestment(inv);
    setFormData({ ...inv });
    setIsModalOpen(true);
  };

  /**
   * Determines risk level based on asset type and sector.
   * MBA Finance logic: Stocks in IT/Other are high risk, FMCG/Mutual Funds are low risk.
   */
  const getRiskLevel = (type: AssetType, sector: Sector, name: string) => {
    let level: 'Low' | 'Medium' | 'High' = 'Low';
    if (type === 'Stock') {
      if (sector === 'IT' || sector === 'Other') level = 'High';
      else if (sector === 'Banking' || sector === 'Energy') level = 'Medium';
      else level = 'Low';
    }

    // Elevate risk if sentiment is negative
    const sentiment = portfolio.sentiments[name];
    if (sentiment && sentiment.overallSentiment === 'Negative') {
      if (level === 'Low') level = 'Medium';
      else if (level === 'Medium') level = 'High';
    }

    const styles = {
      'Low': 'text-green-600 bg-green-50 dark:bg-emerald-900/20 dark:text-emerald-400',
      'Medium': 'text-yellow-600 bg-yellow-50 dark:bg-amber-900/20 dark:text-amber-400',
      'High': 'text-red-500 bg-red-50 dark:bg-rose-900/20 dark:text-rose-400'
    };

    return { label: level, color: styles[level] };
  };

  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Sector', 'Quantity', 'Buy Price', 'Current Price', 'Date', 'Invested Value', 'Current Value', 'Profit/Loss'];
    const rows = investments.map(inv => [
      inv.name,
      inv.type,
      inv.sector,
      inv.quantity,
      inv.buyPrice,
      inv.currentPrice,
      inv.date,
      inv.quantity * inv.buyPrice,
      inv.quantity * inv.currentPrice,
      inv.quantity * (inv.currentPrice - inv.buyPrice)
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "portfolio_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Navigation */}
      <nav className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500 p-2 rounded-lg">
                <TrendingUp className="text-white w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Smart Portfolio</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadAlertsCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                      {unreadAlertsCount}
                    </span>
                  )}
                </button>

                {isAlertsOpen && (
                  <div className={cn(
                    "absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
                    isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                  )}>
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="font-bold text-sm">Alerts</h4>
                      <button onClick={() => setIsAlertsOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {portfolio.alerts?.length > 0 ? (
                        portfolio.alerts.map(alert => (
                          <div 
                            key={alert.id} 
                            className={cn(
                              "p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors",
                              !alert.isRead ? (isDarkMode ? "bg-emerald-900/10" : "bg-emerald-50/50") : ""
                            )}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">{alert.type.replace('_', ' ')}</p>
                                <p className="text-sm leading-tight">{alert.message}</p>
                                <p className="text-[10px] text-slate-400">{format(new Date(alert.date), 'dd MMM, HH:mm')}</p>
                              </div>
                              {!alert.isRead && (
                                <button 
                                  onClick={() => handleMarkAsRead(alert.id)}
                                  className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded transition-colors"
                                  title="Mark as read"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-sm">
                          No alerts at the moment.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Investment</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl w-fit mb-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'dashboard' 
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'list' 
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <List className="w-4 h-4" />
            Investments
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'history' 
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'pnl' 
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            P&L
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-medium text-slate-500">Available Funds</p>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => { setFundsAction('add'); setIsFundsModalOpen(true); }}
                      className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded transition-colors"
                      title="Add Funds"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { setFundsAction('withdraw'); setIsFundsModalOpen(true); }}
                      className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded transition-colors"
                      title="Withdraw Funds"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-emerald-500">₹{portfolio.availableFunds.toLocaleString()}</h3>
                <div className="mt-4 flex items-center gap-1 text-xs text-slate-400">
                  <Wallet className="w-3 h-3" />
                  <span>Ready to invest</span>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Invested</p>
                <h3 className="text-2xl font-bold">₹{summary.totalInvested.toLocaleString()}</h3>
                <div className="mt-4 flex items-center gap-1 text-xs text-slate-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>Across {summary.assetCount} assets</span>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Current Value</p>
                <h3 className="text-2xl font-bold">₹{summary.totalCurrentValue.toLocaleString()}</h3>
                <div className={cn(
                  "mt-4 flex items-center gap-1 text-xs font-semibold",
                  summary.unrealizedProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.unrealizedProfitLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{summary.overallReturnPercentage.toFixed(2)}% Return</span>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Unrealized P&L</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  summary.unrealizedProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.unrealizedProfitLoss >= 0 ? '+' : ''}₹{summary.unrealizedProfitLoss.toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Profit from current holdings</p>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Realized P&L</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  summary.realizedProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.realizedProfitLoss >= 0 ? '+' : ''}₹{summary.realizedProfitLoss.toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Profit from sold assets</p>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Profit/Loss</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  summary.totalProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.totalProfitLoss >= 0 ? '+' : ''}₹{summary.totalProfitLoss.toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Net portfolio growth</p>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Best Performer</p>
                <h3 className="text-lg font-bold truncate">{summary.bestPerformer?.name || 'N/A'}</h3>
                {summary.bestPerformer && (
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{( ( (summary.bestPerformer.currentPrice - summary.bestPerformer.buyPrice) / summary.bestPerformer.buyPrice ) * 100 ).toFixed(2)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Portfolio Value Over Time
                  </h4>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.historyPoints}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                          borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                        formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Total Value']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    P&L Performance Over Time
                  </h4>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.pnlHistory}>
                      <defs>
                        <linearGradient id="colorRealizedDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorUnrealizedDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#0f172a' : '#fff', 
                          borderColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} />
                      <Area 
                        type="monotone" 
                        dataKey="realized" 
                        name="Realized"
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorRealizedDash)" 
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="unrealized" 
                        name="Unrealized"
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorUnrealizedDash)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sector Allocation */}
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-emerald-500" />
                    Sector Allocation
                  </h4>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                          borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                          color: isDarkMode ? '#f1f5f9' : '#0f172a'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Holdings */}
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold flex items-center gap-2">
                    <List className="w-4 h-4 text-emerald-500" />
                    Portfolio Holdings
                  </h4>
                  <button 
                    onClick={() => setActiveTab('list')}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {investments.slice(0, 4).map((inv) => {
                    const profit = (inv.currentPrice - inv.buyPrice) * inv.quantity;
                    const returns = ((inv.currentPrice - inv.buyPrice) / inv.buyPrice) * 100;
                    const risk = getRiskLevel(inv.type, inv.sector, inv.name);
                    return (
                      <button 
                        key={inv.id} 
                        onClick={() => handleViewDetails(inv)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                            inv.type === 'Stock' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                          )}>
                            {inv.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold flex items-center gap-1">
                              {inv.name}
                              <span className={cn("w-1.5 h-1.5 rounded-full", risk.color.replace('bg-', 'bg-').replace('text-', 'bg-'))} />
                            </p>
                            <p className="text-[10px] text-slate-400">{inv.quantity} units • {inv.sector}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">₹{(inv.quantity * inv.currentPrice).toLocaleString()}</p>
                          <p className={cn(
                            "text-[10px] font-bold",
                            profit >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {profit >= 0 ? '+' : ''}{returns.toFixed(1)}%
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {investments.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8 italic">No holdings yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className={cn(
              "p-6 rounded-2xl border shadow-sm",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Top Profit Contributors
                </h4>
              </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.barData}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                          borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                          color: isDarkMode ? '#f1f5f9' : '#0f172a'
                        }}
                      />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {chartData.barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
        ) : activeTab === 'list' ? (
          <div className={cn(
            "rounded-2xl border shadow-sm overflow-hidden",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            {/* List Controls */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="All">All Types</option>
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <select 
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value as any)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="All">All Sectors</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="relative">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="return">Sort by Return %</option>
                    <option value="profit">Sort by Profit</option>
                    <option value="value">Sort by Value</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => refreshAllSentiments(investments, true)}
                  disabled={isRefreshingSentiment}
                  className={cn(
                    "flex items-center gap-2 text-slate-500 hover:text-emerald-500 transition-colors text-sm font-medium",
                    isRefreshingSentiment && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <History className={cn("w-4 h-4", isRefreshingSentiment && "animate-spin")} />
                  {isRefreshingSentiment ? 'Analyzing...' : 'Refresh Sentiment'}
                </button>
                <button 
                  onClick={exportCSV}
                  className="flex items-center gap-2 text-slate-500 hover:text-emerald-500 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Asset</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Quantity</th>
                    <th className="px-6 py-4 font-semibold">Invested</th>
                    <th className="px-6 py-4 font-semibold">Current</th>
                    <th className="px-6 py-4 font-semibold">Profit/Loss</th>
                    <th className="px-6 py-4 font-semibold">Return %</th>
                    <th className="px-6 py-4 font-semibold">Risk</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvestments.map((inv) => {
                    const invested = inv.quantity * inv.buyPrice;
                    const current = inv.quantity * inv.currentPrice;
                    const profit = current - invested;
                    const returns = (profit / invested) * 100;
                    const risk = getRiskLevel(inv.type, inv.sector, inv.name);

                    return (
                      <tr 
                        key={inv.id} 
                        onClick={() => handleViewDetails(inv)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold flex items-center gap-2">
                            {inv.name}
                            {portfolio.alerts?.some(a => a.investmentId === inv.id && !a.isRead) && (
                              <AlertCircle className="w-3 h-3 text-rose-500 animate-pulse" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{inv.sector}</span>
                            {portfolio.sentiments[inv.name] && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAssetNews(portfolio.sentiments[inv.name]);
                                  setIsNewsModalOpen(true);
                                }}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors",
                                  portfolio.sentiments[inv.name].overallSentiment === 'Positive' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                  portfolio.sentiments[inv.name].overallSentiment === 'Negative' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {portfolio.sentiments[inv.name].overallSentiment}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                            inv.type === 'Stock' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                          )}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{inv.quantity}</td>
                        <td className="px-6 py-4 text-sm font-medium">₹{invested.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            ₹{current.toLocaleString()}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setUpdatePriceValue(inv.currentPrice);
                                setUpdatePriceDate(new Date().toISOString().split('T')[0]);
                                setViewingInvestment(inv);
                                setIsViewModalOpen(true);
                                setIsUpdatingPrice(true);
                              }}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-500 rounded transition-colors"
                              title="Quick Price Update"
                            >
                              <TrendingUp className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-sm font-bold",
                          profit >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {profit >= 0 ? '+' : ''}₹{profit.toLocaleString()}
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-sm font-bold",
                          returns >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {returns >= 0 ? '+' : ''}{returns.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-full", risk.color)}>
                            {risk.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSellClick(inv);
                              }}
                              className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                            >
                              Sell
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(inv);
                              }}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(inv);
                              }}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(inv.id);
                              }}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredInvestments.length === 0 && (
                <div className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No investments found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className={cn(
            "rounded-2xl border shadow-sm overflow-hidden",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-500" />
                Transaction History
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Date & Time</th>
                    <th className="px-6 py-4 font-semibold">Asset</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Quantity</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {portfolio.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {format(new Date(tx.date), 'dd MMM yyyy, HH:mm')}
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">{tx.assetName}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full w-fit",
                          (tx.type === 'BUY' || tx.type === 'WITHDRAW') ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}>
                          {(tx.type === 'BUY' || tx.type === 'WITHDRAW') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{tx.quantity || '-'}</td>
                      <td className="px-6 py-4 text-sm">{tx.price ? `₹${tx.price.toLocaleString()}` : '-'}</td>
                      <td className={cn(
                        "px-6 py-4 text-sm font-bold text-right",
                        (tx.type === 'BUY' || tx.type === 'WITHDRAW') ? "text-rose-500" : "text-emerald-500"
                      )}>
                        {(tx.type === 'BUY' || tx.type === 'WITHDRAW') ? '-' : '+'}₹{tx.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {portfolio.transactions.length === 0 && (
                <div className="p-12 text-center">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No transactions recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Realized P&L</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  summary.realizedProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.realizedProfitLoss >= 0 ? '+' : ''}₹{summary.realizedProfitLoss.toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Profit from closed positions</p>
              </div>
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Unrealized P&L</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  summary.totalProfitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.totalProfitLoss >= 0 ? '+' : ''}₹{summary.totalProfitLoss.toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Profit from current holdings</p>
              </div>
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <p className="text-sm font-medium text-slate-500 mb-1">Net P&L</p>
                <h3 className={cn(
                  "text-2xl font-bold",
                  (summary.totalProfitLoss + summary.realizedProfitLoss) >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {(summary.totalProfitLoss + summary.realizedProfitLoss) >= 0 ? '+' : ''}₹{(summary.totalProfitLoss + summary.realizedProfitLoss).toLocaleString()}
                </h3>
                <p className="mt-4 text-xs text-slate-400">Combined portfolio performance</p>
              </div>
            </div>

            <div className={cn(
              "p-6 rounded-2xl border shadow-sm",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  P&L Performance Over Time
                </h4>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.pnlHistory}>
                    <defs>
                      <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorUnrealized" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(value) => `₹${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#0f172a' : '#fff', 
                        borderColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '20px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="realized" 
                      name="Realized P&L"
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorRealized)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="unrealized" 
                      name="Unrealized P&L"
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorUnrealized)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={cn(
              "rounded-2xl border shadow-sm overflow-hidden",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Realized P&L Details
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Asset</th>
                      <th className="px-6 py-4 font-semibold">Quantity</th>
                      <th className="px-6 py-4 font-semibold">Buy Price</th>
                      <th className="px-6 py-4 font-semibold">Sell Price</th>
                      <th className="px-6 py-4 font-semibold text-right">Profit/Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {portfolio.transactions
                      .filter(tx => tx.type === 'SELL' && tx.buyPrice !== undefined)
                      .map((tx) => {
                        const pnl = (tx.price! - tx.buyPrice!) * tx.quantity!;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-sm">{tx.assetName}</td>
                            <td className="px-6 py-4 text-sm">{tx.quantity}</td>
                            <td className="px-6 py-4 text-sm">₹{tx.buyPrice?.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm">₹{tx.price?.toLocaleString()}</td>
                            <td className={cn(
                              "px-6 py-4 text-sm font-bold text-right",
                              pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {portfolio.transactions.filter(tx => tx.type === 'SELL' && tx.buyPrice !== undefined).length === 0 && (
                  <div className="p-12 text-center">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No realized profit/loss recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingInvestment ? 'Edit Investment' : 'Add New Investment'}</h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingInvestment(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Available Funds</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{portfolio.availableFunds.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Asset Type</label>
                  <select 
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as AssetType})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sector</label>
                  <select 
                    required
                    value={formData.sector}
                    onChange={(e) => setFormData({...formData, sector: e.target.value as Sector})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Asset Name</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI Bluechip"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Quantity</label>
                  <input 
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity ?? ''}
                    onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Buy Price</label>
                  <input 
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.buyPrice ?? ''}
                    onChange={(e) => setFormData({...formData, buyPrice: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Current Price</label>
                  <input 
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.currentPrice ?? ''}
                    onChange={(e) => setFormData({...formData, currentPrice: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Investment Date</label>
                  <input 
                    required
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Risk Threshold</label>
                  <select 
                    required
                    value={formData.riskThreshold}
                    onChange={(e) => setFormData({...formData, riskThreshold: e.target.value as RiskLevel})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {editingInvestment ? 'Update Investment' : 'Add Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Funds Management Modal */}
      {isFundsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className={cn(
                "text-xl font-bold",
                fundsAction === 'add' ? "text-emerald-500" : "text-rose-500"
              )}>
                {fundsAction === 'add' ? 'Add Funds' : 'Withdraw Funds'}
              </h2>
              <button 
                onClick={() => setIsFundsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleFundsSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Available Funds</span>
                  <span className="font-bold">₹{portfolio.availableFunds.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                <input 
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={fundsAmount || ''}
                  onChange={(e) => setFundsAmount(parseFloat(e.target.value))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 outline-none",
                    fundsAction === 'add' ? "focus:ring-emerald-500" : "focus:ring-rose-500"
                  )}
                  placeholder="Enter amount"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all shadow-lg",
                    fundsAction === 'add' 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20" 
                      : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
                  )}
                >
                  Confirm {fundsAction === 'add' ? 'Deposit' : 'Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && viewingInvestment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn(
            "w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{viewingInvestment.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{viewingInvestment.type} • {viewingInvestment.sector}</p>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Quantity</p>
                  <p className="text-lg font-bold">{viewingInvestment.quantity}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Invested Value</p>
                  <p className="text-lg font-bold">₹{(viewingInvestment.quantity * viewingInvestment.buyPrice).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Current Value</p>
                  <p className="text-lg font-bold">₹{(viewingInvestment.quantity * viewingInvestment.currentPrice).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Profit/Loss</p>
                  <p className={cn(
                    "text-lg font-bold",
                    (viewingInvestment.currentPrice - viewingInvestment.buyPrice) >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    ₹{(viewingInvestment.quantity * (viewingInvestment.currentPrice - viewingInvestment.buyPrice)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">Price History</h4>
                  <button 
                    onClick={() => {
                      setUpdatePriceValue(viewingInvestment.currentPrice);
                      setUpdatePriceDate(new Date().toISOString().split('T')[0]);
                      setIsUpdatingPrice(!isUpdatingPrice);
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    {isUpdatingPrice ? 'Cancel' : 'Update Price'}
                  </button>
                </div>

                {isUpdatingPrice && (
                  <form onSubmit={handleUpdatePrice} className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">New Price</label>
                        <input 
                          type="number"
                          step="0.01"
                          required
                          value={updatePriceValue}
                          onChange={(e) => setUpdatePriceValue(parseFloat(e.target.value))}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                        <input 
                          type="date"
                          required
                          value={updatePriceDate}
                          onChange={(e) => setUpdatePriceDate(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Save Price Point
                    </button>
                  </form>
                )}

                {viewingInvestment.priceHistory && viewingInvestment.priceHistory.length > 0 ? (
                  <div className="h-40 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={viewingInvestment.priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="date" 
                          hide 
                        />
                        <YAxis 
                          hide 
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                          labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                          formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Price']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          dot={{ r: 3, fill: '#10b981' }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400">No price history available yet.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold">Market Sentiment</h4>
                {portfolio.sentiments[viewingInvestment.name] ? (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        portfolio.sentiments[viewingInvestment.name].overallSentiment === 'Positive' ? "bg-emerald-500" :
                        portfolio.sentiments[viewingInvestment.name].overallSentiment === 'Negative' ? "bg-rose-500" :
                        "bg-slate-500"
                      )} />
                      <span className="font-bold">{portfolio.sentiments[viewingInvestment.name].overallSentiment}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setIsViewModalOpen(false);
                        setSelectedAssetNews(portfolio.sentiments[viewingInvestment.name]);
                        setIsNewsModalOpen(true);
                      }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                    >
                      View News Feed
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sentiment data not available. Try refreshing.</p>
                )}
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleEdit(viewingInvestment);
                }}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors"
              >
                Edit Investment
              </button>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {isNewsModalOpen && selectedAssetNews && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn(
            "w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedAssetNews.assetName} Sentiment</h3>
                <p className="text-xs text-slate-400 mt-1">Last updated: {format(new Date(selectedAssetNews.lastUpdated), 'dd MMM, HH:mm')}</p>
              </div>
              <button 
                onClick={() => setIsNewsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">Overall Sentiment</p>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedAssetNews.overallSentiment === 'Positive' ? "text-emerald-500" :
                    selectedAssetNews.overallSentiment === 'Negative' ? "text-rose-500" :
                    "text-slate-500"
                  )}>
                    {selectedAssetNews.overallSentiment}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">Sentiment Score</p>
                  <p className="text-lg font-bold font-mono">
                    {selectedAssetNews.score > 0 ? '+' : ''}{selectedAssetNews.score.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-500" />
                  Recent Relevant News
                </h4>
                <div className="space-y-3">
                  {selectedAssetNews.news.length > 0 ? (
                    selectedAssetNews.news.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 transition-colors">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                            item.sentiment === 'Positive' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            item.sentiment === 'Negative' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {item.sentiment}
                          </span>
                          <span className="text-[10px] text-slate-400">{item.date}</span>
                        </div>
                        <h5 className="text-sm font-bold leading-tight mb-1">{item.title}</h5>
                        <p className="text-[10px] text-slate-500">{item.source}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">No recent news found.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button 
                onClick={() => setIsNewsModalOpen(false)}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isSellModalOpen && sellingInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-rose-500">Sell {sellingInvestment.name}</h2>
              <button 
                onClick={() => setIsSellModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSellSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Current Holding</span>
                  <span className="font-bold">{sellingInvestment.quantity} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Current Market Price</span>
                  <span className="font-bold">₹{sellingInvestment.currentPrice.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Quantity to Sell</label>
                <input 
                  required
                  type="number"
                  min="0.01"
                  max={sellingInvestment.quantity}
                  step="0.01"
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Selling Price (per unit)</label>
                <input 
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Total Proceeds</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{(sellQuantity * sellPrice).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-500/20"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
            isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Delete Investment?</h3>
              <p className="text-slate-500 text-sm mb-6">
                This action cannot be undone. Are you sure you want to remove this asset from your portfolio?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 dark:border-slate-800 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm">
          <p>© 2026 Smart Portfolio Tracker. FinTech Project Demo.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-emerald-500 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
