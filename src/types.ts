export interface Transaction {
  id: string;
  investmentId?: string;
  assetName: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  quantity?: number;
  price?: number;
  buyPrice?: number; // Cost basis for SELL transactions
  totalAmount: number;
  date: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface Alert {
  id: string;
  investmentId: string;
  assetName: string;
  type: 'RISK_EXCEEDED' | 'PRICE_DROP';
  message: string;
  date: string;
  isRead: boolean;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
}

export interface AssetSentiment {
  assetName: string;
  overallSentiment: 'Positive' | 'Neutral' | 'Negative';
  score: number; // -1 to 1
  news: NewsItem[];
  lastUpdated: string;
}

export interface PortfolioState {
  availableFunds: number;
  investments: Investment[];
  transactions: Transaction[];
  alerts: Alert[];
  sentiments: Record<string, AssetSentiment>; // Key is assetName
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface Investment {
  id: string;
  type: AssetType;
  name: string;
  sector: Sector;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  date: string;
  riskThreshold?: RiskLevel;
  priceHistory?: PricePoint[];
}

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalProfitLoss: number;
  unrealizedProfitLoss: number;
  realizedProfitLoss: number;
  overallReturnPercentage: number;
  assetCount: number;
  bestPerformer: Investment | null;
  worstPerformer: Investment | null;
}

export type AssetType = 'Stock' | 'Mutual Fund';

export type Sector = 
  | 'Banking' 
  | 'IT' 
  | 'Pharma' 
  | 'FMCG' 
  | 'Energy' 
  | 'Automobile' 
  | 'Real Estate' 
  | 'Other';

export const SECTORS: Sector[] = [
  'Banking', 'IT', 'Pharma', 'FMCG', 'Energy', 'Automobile', 'Real Estate', 'Other'
];

export const ASSET_TYPES: AssetType[] = ['Stock', 'Mutual Fund'];
